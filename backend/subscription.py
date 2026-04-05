"""
SupplySight — Subscription & Payment Module (Razorpay)
Handles subscription plans, Razorpay order creation, and payment verification.
"""
import os
import hmac
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.auth import get_current_user

# ─── Razorpay Configuration ────────────────────────────────────────
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

# ─── Pydantic Schemas ──────────────────────────────────────────────
class CreateOrderRequest(BaseModel):
    plan_id: int


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: int


# ─── Router ─────────────────────────────────────────────────────────
router = APIRouter(prefix="/api/subscription", tags=["Subscription"])


# ─── GET /plans — List all plans (public) ───────────────────────────
@router.get("/plans")
def get_plans(db: Session = Depends(get_db)):
    """Return all active subscription plans."""
    result = db.execute(text(
        "SELECT * FROM subscription_plan WHERE is_active = TRUE ORDER BY price_monthly ASC"
    ))
    return [dict(row._mapping) for row in result]


# ─── GET /my — Current user's active subscription ──────────────────
@router.get("/my")
def get_my_subscription(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Get the current user's active subscription with plan details."""
    result = db.execute(text("""
        SELECT us.*, sp.plan_name, sp.price_monthly,
               sp.max_suppliers, sp.max_products,
               sp.has_pipeline, sp.has_map, sp.has_ai_chat,
               sp.ai_chat_limit, sp.has_export
        FROM user_subscription us
        JOIN subscription_plan sp ON us.plan_id = sp.plan_id
        WHERE us.user_id = :uid AND us.status = 'active'
        ORDER BY us.created_at DESC
        LIMIT 1
    """), {"uid": user["user_id"]})
    row = result.fetchone()

    if not row:
        # Auto-assign starter plan if none exists
        starter = db.execute(text(
            "SELECT plan_id FROM subscription_plan WHERE plan_name = 'Starter'"
        )).fetchone()
        if starter:
            db.execute(text("""
                INSERT INTO user_subscription (user_id, plan_id, status, amount_paid)
                VALUES (:uid, :pid, 'active', 0)
            """), {"uid": user["user_id"], "pid": starter[0]})
            db.commit()
            # Re-fetch
            result = db.execute(text("""
                SELECT us.*, sp.plan_name, sp.price_monthly,
                       sp.max_suppliers, sp.max_products,
                       sp.has_pipeline, sp.has_map, sp.has_ai_chat,
                       sp.ai_chat_limit, sp.has_export
                FROM user_subscription us
                JOIN subscription_plan sp ON us.plan_id = sp.plan_id
                WHERE us.user_id = :uid AND us.status = 'active'
                ORDER BY us.created_at DESC
                LIMIT 1
            """), {"uid": user["user_id"]})
            row = result.fetchone()

    if row:
        return dict(row._mapping)
    return {"plan_name": "Starter", "status": "active"}


# ─── POST /create-order — Create Razorpay order ────────────────────
@router.post("/create-order")
def create_order(
    req: CreateOrderRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Create a Razorpay order for the selected plan."""
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay not configured")

    # Fetch plan
    plan = db.execute(text(
        "SELECT * FROM subscription_plan WHERE plan_id = :pid AND is_active = TRUE"
    ), {"pid": req.plan_id}).fetchone()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan_dict = dict(plan._mapping)

    if plan_dict["price_monthly"] == 0:
        # Free plan — just activate directly
        _activate_subscription(db, user["user_id"], plan_dict["plan_id"], 0, None, None, None)
        return {"success": True, "free": True, "plan_name": plan_dict["plan_name"]}

    # Create Razorpay order via their API
    import razorpay
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

    amount_paise = int(plan_dict["price_monthly"] * 100)  # Razorpay uses paise

    order_data = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"sub_{user['user_id']}_{plan_dict['plan_id']}",
        "notes": {
            "user_id": str(user["user_id"]),
            "plan_id": str(plan_dict["plan_id"]),
            "plan_name": plan_dict["plan_name"],
        },
    }

    try:
        order = client.order.create(data=order_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay error: {str(e)}")

    # Save pending subscription
    db.execute(text("""
        INSERT INTO user_subscription (user_id, plan_id, status, razorpay_order_id, amount_paid)
        VALUES (:uid, :pid, 'pending', :oid, :amount)
    """), {
        "uid": user["user_id"],
        "pid": plan_dict["plan_id"],
        "oid": order["id"],
        "amount": plan_dict["price_monthly"],
    })
    db.commit()

    return {
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": RAZORPAY_KEY_ID,
        "plan_name": plan_dict["plan_name"],
        "user_email": user["email"],
        "user_name": user["full_name"],
    }


# ─── POST /verify-payment — Verify Razorpay signature ──────────────
@router.post("/verify-payment")
def verify_payment(
    req: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Verify Razorpay payment signature and activate the subscription."""
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay not configured")

    # Verify signature using HMAC SHA256
    message = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if expected_signature != req.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment verification failed — invalid signature")

    # Fetch the pending subscription
    sub = db.execute(text("""
        SELECT subscription_id, plan_id, amount_paid
        FROM user_subscription
        WHERE user_id = :uid AND razorpay_order_id = :oid AND status = 'pending'
    """), {"uid": user["user_id"], "oid": req.razorpay_order_id}).fetchone()

    if not sub:
        raise HTTPException(status_code=404, detail="Pending subscription not found")

    sub_dict = dict(sub._mapping)

    # Expire old active subscriptions
    db.execute(text("""
        UPDATE user_subscription SET status = 'expired'
        WHERE user_id = :uid AND status = 'active'
    """), {"uid": user["user_id"]})

    # Activate the new subscription
    db.execute(text("""
        UPDATE user_subscription
        SET status = 'active',
            razorpay_payment_id = :pid,
            razorpay_signature = :sig,
            started_at = NOW(),
            expires_at = NOW() + INTERVAL '30 days'
        WHERE subscription_id = :sid
    """), {
        "pid": req.razorpay_payment_id,
        "sig": req.razorpay_signature,
        "sid": sub_dict["subscription_id"],
    })
    db.commit()

    # Fetch updated plan info
    plan = db.execute(text(
        "SELECT plan_name FROM subscription_plan WHERE plan_id = :pid"
    ), {"pid": sub_dict["plan_id"]}).fetchone()

    return {
        "success": True,
        "plan_name": plan[0] if plan else "Unknown",
        "message": f"Welcome to {plan[0]}! Your subscription is now active.",
    }


def _activate_subscription(db, user_id, plan_id, amount, order_id, payment_id, signature):
    """Helper to activate a subscription (used for free plans)."""
    # Expire old active subscriptions
    db.execute(text("""
        UPDATE user_subscription SET status = 'expired'
        WHERE user_id = :uid AND status = 'active'
    """), {"uid": user_id})

    # Insert new active subscription
    db.execute(text("""
        INSERT INTO user_subscription (user_id, plan_id, status, razorpay_order_id,
                                       razorpay_payment_id, razorpay_signature, amount_paid,
                                       started_at, expires_at)
        VALUES (:uid, :pid, 'active', :oid, :pmid, :sig, :amount, NOW(), NULL)
    """), {
        "uid": user_id, "pid": plan_id, "oid": order_id,
        "pmid": payment_id, "sig": signature, "amount": amount,
    })
    db.commit()
