"""
SupplySight — Gemini RAG Chatbot Module
Retrieval-Augmented Generation: fetches live DB data as context,
sends it to Gemini alongside the user query, returns grounded answers.
"""
import os
import traceback
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


# ─── Configuration ──────────────────────────────────────────────────
# Read lazily (at call time) so dotenv has a chance to load first
def _get_api_key():
    return os.getenv("GEMINI_API_KEY", "")


# ─── System Prompt ──────────────────────────────────────────────────
SYSTEM_PROMPT = """You are SupplySight AI, an intelligent supply chain assistant.
You have access to real-time data from the SupplySight database.
Answer questions accurately using ONLY the data provided in the context.
If the data doesn't contain the answer, say so honestly.
Keep responses concise, professional, and actionable.
Use bullet points and formatting for clarity.
When referring to specific numbers, cite the source entity. """


def _fetch_context(db: Session, user: dict) -> str:
    """Fetch relevant supply chain data as context for the LLM."""
    is_admin = user["role"] == "admin"
    company_id = user.get("company_id")

    context_parts = []

    try:
        # Companies
        if is_admin:
            rows = db.execute(text(
                "SELECT company_name, industry, country FROM company"
            )).fetchall()
        else:
            rows = db.execute(text(
                "SELECT company_name, industry, country FROM company WHERE company_id = :cid"
            ), {"cid": company_id}).fetchall()
        if rows:
            context_parts.append("## Companies\n" + "\n".join(
                f"- {r.company_name} ({r.industry}, {r.country})" for r in rows
            ))
    except Exception as e:
        print(f"[RAG ERROR] Companies: {e}")

    try:
        # Suppliers
        if is_admin:
            rows = db.execute(text(
                "SELECT s.supplier_name, s.country, s.reliability_score, s.lead_time_days, c.company_name "
                "FROM supplier s JOIN company c ON s.company_id = c.company_id"
            )).fetchall()
        else:
            rows = db.execute(text(
                "SELECT s.supplier_name, s.country, s.reliability_score, s.lead_time_days, c.company_name "
                "FROM supplier s JOIN company c ON s.company_id = c.company_id WHERE s.company_id = :cid"
            ), {"cid": company_id}).fetchall()
        if rows:
            context_parts.append("## Suppliers\n" + "\n".join(
                f"- {r.supplier_name} ({r.country}) — reliability: {(r.reliability_score or 0)*100:.0f}%, lead time: {r.lead_time_days}d, company: {r.company_name}"
                for r in rows
            ))
    except Exception as e:
        print(f"[RAG ERROR] Suppliers: {e}")

    try:
        # Low Inventory
        q = """
            SELECT p.product_name, i.quantity_available, i.minimum_threshold, w.warehouse_name, i.inventory_status
            FROM inventory i
            JOIN product p ON i.product_id = p.product_id
            JOIN warehouse w ON i.warehouse_id = w.warehouse_id
            JOIN supplier s ON p.supplier_id = s.supplier_id
            WHERE i.quantity_available < i.minimum_threshold
        """
        if not is_admin:
            q += " AND s.company_id = :cid"
            rows = db.execute(text(q), {"cid": company_id}).fetchall()
        else:
            rows = db.execute(text(q)).fetchall()
        if rows:
            context_parts.append("## Low Inventory Alerts\n" + "\n".join(
                f"- {r.product_name}: {r.quantity_available}/{r.minimum_threshold} units at {r.warehouse_name} (status: {r.inventory_status})"
                for r in rows
            ))
    except Exception as e:
        print(f"[RAG ERROR] Inventory: {e}")

    try:
        # Recent Orders
        q = """
            SELECT o.order_id, p.product_name, o.order_quantity, o.order_status, o.priority_level, o.order_date, c.company_name
            FROM orders o
            JOIN product p ON o.product_id = p.product_id
            JOIN company c ON o.company_id = c.company_id
        """
        if not is_admin:
            q += " WHERE o.company_id = :cid"
            q += " ORDER BY o.order_date DESC LIMIT 15"
            rows = db.execute(text(q), {"cid": company_id}).fetchall()
        else:
            q += " ORDER BY o.order_date DESC LIMIT 15"
            rows = db.execute(text(q)).fetchall()
        if rows:
            context_parts.append("## Recent Orders\n" + "\n".join(
                f"- Order #{r.order_id}: {r.product_name} x{r.order_quantity}, status: {r.order_status}, priority: {r.priority_level}, date: {r.order_date}, company: {r.company_name}"
                for r in rows
            ))
    except Exception as e:
        print(f"[RAG ERROR] Orders: {e}")

    try:
        # Delayed Shipments
        q = """
            SELECT sh.shipment_id, p.product_name, sh.expected_delivery_date, sh.shipment_status, s.supplier_name
            FROM shipment sh
            JOIN product p ON sh.product_id = p.product_id
            JOIN supplier s ON sh.supplier_id = s.supplier_id
            WHERE sh.shipment_status = 'Delayed'
        """
        if not is_admin:
            q += " AND s.company_id = :cid"
            rows = db.execute(text(q), {"cid": company_id}).fetchall()
        else:
            rows = db.execute(text(q)).fetchall()
        if rows:
            context_parts.append("## Delayed Shipments\n" + "\n".join(
                f"- Shipment #{r.shipment_id}: {r.product_name} from {r.supplier_name}, expected: {r.expected_delivery_date}"
                for r in rows
            ))
    except Exception as e:
        print(f"[RAG ERROR] Shipments: {e}")

    try:
        # Risk Events — scoped by company via entity→supplier chain
        if not is_admin:
            q = """
                SELECT DISTINCT r.risk_id, r.risk_type, r.risk_severity, r.description,
                       r.resolution_status, r.detected_date, r.entity_type, r.entity_id
                FROM risk_event r
                LEFT JOIN shipment sh ON r.entity_type = 'Shipment' AND r.entity_id = sh.shipment_id
                LEFT JOIN inventory inv ON r.entity_type = 'Inventory' AND r.entity_id = inv.inventory_id
                LEFT JOIN product p_inv ON inv.product_id = p_inv.product_id
                LEFT JOIN supplier s ON sh.supplier_id = s.supplier_id
                                     OR p_inv.supplier_id = s.supplier_id
                WHERE s.company_id = :cid
                ORDER BY r.detected_date DESC LIMIT 15
            """
            rows = db.execute(text(q), {"cid": company_id}).fetchall()
        else:
            q = """
                SELECT r.risk_id, r.risk_type, r.risk_severity, r.description,
                       r.resolution_status, r.detected_date, r.entity_type, r.entity_id
                FROM risk_event r
                ORDER BY r.detected_date DESC LIMIT 15
            """
            rows = db.execute(text(q)).fetchall()
        if rows:
            context_parts.append("## Risk Events\n" + "\n".join(
                f"- Risk #{r.risk_id}: {r.risk_type} ({r.risk_severity}) on {r.entity_type} #{r.entity_id} — {r.description} [status: {r.resolution_status}, detected: {r.detected_date}]"
                for r in rows
            ))
    except Exception as e:
        print(f"[RAG ERROR] Risks: {e}")

    try:
        # Summary stats
        if is_admin:
            total_q = "SELECT " + ", ".join([
                "(SELECT COUNT(*) FROM company) as companies",
                "(SELECT COUNT(*) FROM supplier) as suppliers",
                "(SELECT COUNT(*) FROM product) as products",
                "(SELECT COUNT(*) FROM warehouse) as warehouses",
                "(SELECT COUNT(*) FROM orders) as orders",
                "(SELECT COUNT(*) FROM shipment) as shipments",
                "(SELECT COUNT(*) FROM risk_event WHERE resolution_status IN ('Open','Investigating')) as open_risks",
            ])
            totals = db.execute(text(total_q)).fetchone()
            if totals:
                context_parts.append(
                    f"## Summary Stats (Global)\n"
                    f"- Companies: {totals.companies}, Suppliers: {totals.suppliers}, Products: {totals.products}\n"
                    f"- Warehouses: {totals.warehouses}, Orders: {totals.orders}, Shipments: {totals.shipments}\n"
                    f"- Open/Investigating Risks: {totals.open_risks}"
                )
        else:
            # Scoped counts
            total_q = "SELECT " + ", ".join([
                " (SELECT COUNT(*) FROM supplier WHERE company_id = :cid) as suppliers",
                " (SELECT COUNT(*) FROM product p JOIN supplier s ON p.supplier_id = s.supplier_id WHERE s.company_id = :cid) as products",
                " (SELECT COUNT(*) FROM orders WHERE company_id = :cid) as orders",
                " (SELECT COUNT(*) FROM shipment sh JOIN supplier s ON sh.supplier_id = s.supplier_id WHERE s.company_id = :cid) as shipments"
            ])
            totals = db.execute(text(total_q), {"cid": company_id}).fetchone()
            if totals:
                context_parts.append(
                    f"## Summary Stats (Your Company)\n"
                    f"- Your Suppliers: {totals.suppliers}, Your Products: {totals.products}\n"
                    f"- Your Orders: {totals.orders}, Your Shipments: {totals.shipments}"
                )
    except Exception as e:
        print(f"[RAG ERROR] Stats: {e}")

    return "\n\n".join(context_parts) if context_parts else "No data available."

    return "\n\n".join(context_parts) if context_parts else "No data available."


def chat(message: str, history: list, db: Session, user: dict) -> str:
    """Send a message to Gemini with RAG context and return the response."""
    api_key = _get_api_key()

    if not api_key:
        return "⚠️ Gemini API not configured. Add GEMINI_API_KEY to your .env file.\n\nGet a free key at: https://aistudio.google.com/apikey"

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)

        # Use models available in this environment
        # Primary: gemini-flash-latest, Fallback: gemini-pro-latest
        model_name = "gemini-flash-latest"
        try:
            model = genai.GenerativeModel(model_name)
        except Exception:
            model_name = "gemini-pro-latest"
            model = genai.GenerativeModel(model_name)

        # Build context from live database
        context = _fetch_context(db, user)

        # Build full prompt with context
        full_prompt = (
            f"{SYSTEM_PROMPT}\n\n"
            f"---\n\n"
            f"# Live Database Context\n\n{context}\n\n"
            f"---\n\n"
            f"User's role: {user['role']}, Company ID: {user.get('company_id', 'N/A')}\n\n"
        )

        # Actually, for RAG + History, it's often better to just send the whole block as single prompt
        # if the session state is complex. Let's stick to the structured contents approach but with correct models.
        
        contents = []
        contents.append({"role": "user", "parts": [full_prompt]})
        contents.append({"role": "model", "parts": ["Understood. I have access to the SupplySight data. How can I help?"]})
        
        for h in (history or [])[-6:]:
            if isinstance(h, dict):
                u, a = h.get("user"), h.get("assistant")
                if u: contents.append({"role": "user", "parts": [u]})
                if a: contents.append({"role": "model", "parts": [a]})
        
        contents.append({"role": "user", "parts": [message]})

        response = model.generate_content(contents)
        return response.text

    except Exception as e:
        error_str = str(e)
        print(f"[CHATBOT ERROR] {error_str}")
        print(traceback.format_exc())

        if "quota" in error_str.lower() or "rate" in error_str.lower() or "429" in error_str:
            return "⚠️ Rate limit reached. The free Gemini API has usage limits. Please wait a moment and try again."
        elif "API_KEY_INVALID" in error_str or "invalid" in error_str.lower() and "key" in error_str.lower():
            return "⚠️ Invalid API key. Please check your GEMINI_API_KEY in the .env file."
        elif "model" in error_str.lower() and "not found" in error_str.lower():
            return "⚠️ Model not available. Please try again — the system will auto-fallback to an available model."
        else:
            return f"⚠️ Error communicating with Gemini: {error_str}"
