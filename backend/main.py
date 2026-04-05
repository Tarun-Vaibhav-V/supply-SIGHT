"""
SupplySight — FastAPI Main Application
Full REST API for supply chain monitoring with risk detection.
Includes CRUD endpoints (GET/POST/PUT/DELETE), uses SQL Views.
"""
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
import os

from backend.database import get_db, init_db
from backend.auth import router as auth_router, get_current_user
from backend.subscription import router as subscription_router
from backend.chatbot import chat as chatbot_chat



class OrderCreate(BaseModel):
    company_id: int
    product_id: int
    quantity: int
    priority: str = "Medium"

class StatusUpdate(BaseModel):
    status: str

class ChatRequest(BaseModel):
    message: str
    history: list = []


# ─── Lifespan ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    yield


app = FastAPI(
    title="SupplySight API",
    description="Supply chain monitoring & risk detection system",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend to call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount auth router
app.include_router(auth_router)
app.include_router(subscription_router)


# ─── Helpers ────────────────────────────────────────────────────────
def rows_to_dicts(result):
    """Convert SQLAlchemy result rows to list of dicts."""
    return [dict(row._mapping) for row in result]


def get_company_filter(user: dict) -> Optional[int]:
    """Return company_id if user is a company role, None for admins."""
    if user["role"] == "company":
        return user["company_id"]
    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GET ENDPOINTS (Read)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ─── Dashboard Summary (uses VIEW) ──────────────────────────────────
@app.get("/api/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Returns KPI counts — company-scoped for company users, global for admins."""
    cid = get_company_filter(user)
    if cid:
        result = db.execute(text("""
            SELECT
                1 AS total_companies,
                (SELECT COUNT(*) FROM supplier WHERE company_id = :cid) AS total_suppliers,
                (SELECT COUNT(*) FROM product p JOIN supplier s ON p.supplier_id = s.supplier_id WHERE s.company_id = :cid) AS total_products,
                (SELECT COUNT(*) FROM warehouse) AS total_warehouses,
                (SELECT COUNT(*) FROM orders WHERE company_id = :cid) AS total_orders,
                (SELECT COUNT(*) FROM shipment sh JOIN supplier s ON sh.supplier_id = s.supplier_id WHERE s.company_id = :cid) AS total_shipments,
                (SELECT COUNT(*) FROM inventory i JOIN product p ON i.product_id = p.product_id JOIN supplier s ON p.supplier_id = s.supplier_id WHERE s.company_id = :cid AND i.quantity_available < i.minimum_threshold) AS low_inventory_alerts,
                (SELECT COUNT(*) FROM shipment sh JOIN supplier s ON sh.supplier_id = s.supplier_id WHERE s.company_id = :cid AND sh.actual_delivery_date IS NULL AND sh.expected_delivery_date < CURRENT_DATE) AS delayed_shipment_alerts,
                (SELECT COUNT(*) FROM risk_event WHERE resolution_status IN ('Open','Investigating')) AS open_risks
        """), {"cid": cid})
    else:
        result = db.execute(text("SELECT * FROM v_dashboard_summary"))
    row = result.fetchone()
    if row:
        return dict(row._mapping)
    return {}


# ─── Risk Detection ─────────────────────────────────────────────────
@app.get("/api/risks/low-inventory")
def low_inventory(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Low inventory items — company-scoped for company users."""
    cid = get_company_filter(user)
    if cid:
        result = db.execute(text("""
            SELECT i.inventory_id, p.product_name, p.category,
                   s.supplier_name, s.company_id, w.warehouse_name,
                   i.quantity_available, i.minimum_threshold,
                   i.inventory_status, i.last_updated
            FROM inventory i
            JOIN product p ON i.product_id = p.product_id
            JOIN supplier s ON p.supplier_id = s.supplier_id
            JOIN warehouse w ON i.warehouse_id = w.warehouse_id
            WHERE i.quantity_available < i.minimum_threshold
              AND s.company_id = :cid
            ORDER BY (i.minimum_threshold - i.quantity_available) DESC
        """), {"cid": cid})
    else:
        result = db.execute(text("SELECT * FROM v_low_inventory"))
    return rows_to_dicts(result)


@app.get("/api/risks/delayed-shipments")
def delayed_shipments(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Detect shipments that are overdue — company-scoped for company users."""
    cid = get_company_filter(user)
    base_query = """
        SELECT sh.shipment_id, p.product_name, s.supplier_name,
               s.company_id,
               sh.quantity_shipped, sh.expected_delivery_date,
               sh.shipment_status, sh.transport_mode,
               (CURRENT_DATE - sh.expected_delivery_date) AS days_overdue
        FROM shipment sh
        JOIN product p ON sh.product_id = p.product_id
        JOIN supplier s ON sh.supplier_id = s.supplier_id
        WHERE sh.actual_delivery_date IS NULL
          AND sh.expected_delivery_date < CURRENT_DATE
    """
    if cid:
        base_query += " AND s.company_id = :cid"
    base_query += " ORDER BY sh.expected_delivery_date ASC"
    result = db.execute(text(base_query), {"cid": cid} if cid else {})
    return rows_to_dicts(result)


# ─── CRUD Read Endpoints ───────────────────────────────────────────
@app.get("/api/companies")
def get_companies(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cid = get_company_filter(user)
    if cid:
        result = db.execute(text("SELECT * FROM company WHERE company_id = :cid ORDER BY company_id"), {"cid": cid})
    else:
        result = db.execute(text("SELECT * FROM company ORDER BY company_id"))
    return rows_to_dicts(result)


@app.get("/api/suppliers")
def get_suppliers(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cid = get_company_filter(user)
    if cid:
        result = db.execute(text("""
            SELECT s.*, c.company_name
            FROM supplier s JOIN company c ON s.company_id = c.company_id
            WHERE s.company_id = :cid
            ORDER BY s.supplier_id
        """), {"cid": cid})
    else:
        result = db.execute(text("""
            SELECT s.*, c.company_name
            FROM supplier s JOIN company c ON s.company_id = c.company_id
            ORDER BY s.supplier_id
        """))
    return rows_to_dicts(result)


@app.get("/api/products")
def get_products(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cid = get_company_filter(user)
    if cid:
        result = db.execute(text("""
            SELECT p.*, s.supplier_name
            FROM product p JOIN supplier s ON p.supplier_id = s.supplier_id
            WHERE s.company_id = :cid
            ORDER BY p.product_id
        """), {"cid": cid})
    else:
        result = db.execute(text("""
            SELECT p.*, s.supplier_name
            FROM product p JOIN supplier s ON p.supplier_id = s.supplier_id
            ORDER BY p.product_id
        """))
    return rows_to_dicts(result)


@app.get("/api/warehouses")
def get_warehouses(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    result = db.execute(text("SELECT * FROM warehouse ORDER BY warehouse_id"))
    return rows_to_dicts(result)


@app.get("/api/inventory")
def get_inventory(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cid = get_company_filter(user)
    if cid:
        result = db.execute(text("""
            SELECT i.*, p.product_name, w.warehouse_name
            FROM inventory i
            JOIN product p ON i.product_id = p.product_id
            JOIN supplier s ON p.supplier_id = s.supplier_id
            JOIN warehouse w ON i.warehouse_id = w.warehouse_id
            WHERE s.company_id = :cid
            ORDER BY i.inventory_id
        """), {"cid": cid})
    else:
        result = db.execute(text("""
            SELECT i.*, p.product_name, w.warehouse_name
            FROM inventory i
            JOIN product p ON i.product_id = p.product_id
            JOIN warehouse w ON i.warehouse_id = w.warehouse_id
            ORDER BY i.inventory_id
        """))
    return rows_to_dicts(result)


@app.get("/api/shipments")
def get_shipments(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cid = get_company_filter(user)
    if cid:
        result = db.execute(text("""
            SELECT sh.*, p.product_name, s.supplier_name
            FROM shipment sh
            JOIN product p ON sh.product_id = p.product_id
            JOIN supplier s ON sh.supplier_id = s.supplier_id
            WHERE s.company_id = :cid
            ORDER BY sh.shipment_id
        """), {"cid": cid})
    else:
        result = db.execute(text("""
            SELECT sh.*, p.product_name, s.supplier_name
            FROM shipment sh
            JOIN product p ON sh.product_id = p.product_id
            JOIN supplier s ON sh.supplier_id = s.supplier_id
            ORDER BY sh.shipment_id
        """))
    return rows_to_dicts(result)


@app.get("/api/orders")
def get_orders(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cid = get_company_filter(user)
    if cid:
        result = db.execute(text("""
            SELECT o.*, c.company_name, p.product_name
            FROM orders o
            JOIN company c ON o.company_id = c.company_id
            JOIN product p ON o.product_id = p.product_id
            WHERE o.company_id = :cid
            ORDER BY o.order_date DESC
        """), {"cid": cid})
    else:
        result = db.execute(text("""
            SELECT o.*, c.company_name, p.product_name
            FROM orders o
            JOIN company c ON o.company_id = c.company_id
            JOIN product p ON o.product_id = p.product_id
            ORDER BY o.order_date DESC
        """))
    return rows_to_dicts(result)


@app.get("/api/risks")
def get_risks(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    cid = get_company_filter(user)
    if cid:
        # Filter risks to those related to this company's suppliers
        result = db.execute(text("""
            SELECT DISTINCT r.* FROM risk_event r
            LEFT JOIN shipment sh ON r.entity_type = 'Shipment' AND r.entity_id = sh.shipment_id
            LEFT JOIN inventory inv ON r.entity_type = 'Inventory' AND r.entity_id = inv.inventory_id
            LEFT JOIN product p_inv ON inv.product_id = p_inv.product_id
            LEFT JOIN supplier s ON sh.supplier_id = s.supplier_id
                                 OR p_inv.supplier_id = s.supplier_id
            WHERE s.company_id = :cid
            ORDER BY r.detected_date DESC, r.risk_id DESC
        """), {"cid": cid})
    else:
        result = db.execute(text(
            "SELECT * FROM risk_event ORDER BY detected_date DESC, risk_id DESC"
        ))
    return rows_to_dicts(result)


# ─── Supplier Reliability (uses VIEW) ──────────────────────────────
@app.get("/api/suppliers/reliability")
def supplier_reliability(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Supplier reliability — company-scoped for company users."""
    cid = get_company_filter(user)
    if cid:
        result = db.execute(text("""
            SELECT vp.* FROM v_supplier_performance vp
            JOIN supplier s ON vp.supplier_id = s.supplier_id
            WHERE s.company_id = :cid
        """), {"cid": cid})
    else:
        result = db.execute(text("SELECT * FROM v_supplier_performance"))
    return rows_to_dicts(result)


# ─── Dropdown Data for Forms ────────────────────────────────────────
@app.get("/api/dropdown/companies")
def dropdown_companies(db: Session = Depends(get_db)):
    """Public endpoint for registration company dropdown."""
    result = db.execute(text("SELECT company_id, company_name FROM company ORDER BY company_name"))
    return rows_to_dicts(result)


@app.get("/api/dropdown/products")
def dropdown_products(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    result = db.execute(text("""
        SELECT p.product_id, p.product_name, s.supplier_name
        FROM product p JOIN supplier s ON p.supplier_id = s.supplier_id
        ORDER BY p.product_name
    """))
    return rows_to_dicts(result)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# POST / PUT / DELETE ENDPOINTS (Write — Full CRUD)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ─── Create Order (uses fn_place_order — Transaction Demo) ──────────
@app.post("/api/orders")
def create_order(order: OrderCreate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """
    Place a new order using the fn_place_order() stored function.
    This demonstrates a TRANSACTION: validates stock → inserts order
    → reduces inventory → updates status, all atomically.
    """
    try:
        result = db.execute(text(
            "SELECT * FROM fn_place_order(:company, :product, :qty, :priority)"
        ), {
            "company": order.company_id,
            "product": order.product_id,
            "qty": order.quantity,
            "priority": order.priority,
        })
        row = result.fetchone()
        db.commit()
        return {"success": True, "order_id": row[0], "message": row[1]}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ─── Resolve Risk Event (PUT) ──────────────────────────────────────
@app.put("/api/risks/{risk_id}/resolve")
def resolve_risk(risk_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Mark a risk event as Resolved."""
    result = db.execute(text(
        "UPDATE risk_event SET resolution_status = 'Resolved' "
        "WHERE risk_id = :id AND resolution_status IN ('Open', 'Investigating') "
        "RETURNING risk_id"
    ), {"id": risk_id})
    row = result.fetchone()
    db.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Risk not found or already resolved")
    return {"success": True, "message": f"Risk #{risk_id} resolved"}


# ─── Delete / Dismiss Risk Event (DELETE) ───────────────────────────
@app.delete("/api/risks/{risk_id}")
def delete_risk(risk_id: int, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """Dismiss (delete) a risk event."""
    result = db.execute(text(
        "DELETE FROM risk_event WHERE risk_id = :id RETURNING risk_id"
    ), {"id": risk_id})
    row = result.fetchone()
    db.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Risk not found")
    return {"success": True, "message": f"Risk #{risk_id} dismissed"}


# ─── Update Shipment Status (PUT) ──────────────────────────────────
@app.put("/api/shipments/{shipment_id}/status")
def update_shipment_status(shipment_id: int, body: StatusUpdate, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """
    Update a shipment's status. If set to 'Delayed', the
    trg_shipment_delay TRIGGER will auto-create a risk event.
    """
    valid = ['In Transit', 'Delivered', 'Delayed', 'Cancelled']
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be: {valid}")

    update_fields = "shipment_status = :status"
    if body.status == 'Delivered':
        update_fields += ", actual_delivery_date = CURRENT_DATE"

    result = db.execute(text(
        f"UPDATE shipment SET {update_fields} "
        "WHERE shipment_id = :id RETURNING shipment_id"
    ), {"id": shipment_id, "status": body.status})
    row = result.fetchone()
    db.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return {"success": True, "message": f"Shipment #{shipment_id} → {body.status}"}


# ─── Detect All Risks (uses Stored Function) ───────────────────────
@app.post("/api/risks/detect")
def detect_risks(db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    """
    Run the fn_detect_all_risks() stored function.
    Scans inventory + shipments and creates new risk events.
    Admin only — company users cannot trigger global scans.
    """
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can run risk detection scans")
    result = db.execute(text("SELECT * FROM fn_detect_all_risks()"))
    row = result.fetchone()
    db.commit()
    count = row[0] if row else 0
    return {"success": True, "new_risks_created": count,
            "message": f"{count} new risk(s) detected" if count else "No new risks found"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CHATBOT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@app.post("/api/chat")
def chat_endpoint(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to the SupplySight AI chatbot."""
    response = chatbot_chat(req.message, req.history, db, current_user)
    return {"response": response}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SERVE FRONTEND
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")


@app.get("/")
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
