"""
SupplySight — SQLAlchemy ORM Models
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, Date, Text, Numeric, ForeignKey, CheckConstraint
)
from backend.database import Base


class Company(Base):
    __tablename__ = "company"
    company_id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(150), nullable=False)
    industry = Column(String(100))
    country = Column(String(100))
    contact_email = Column(String(150))
    contact_phone = Column(String(30))
    created_at = Column(Date)
    status = Column(String(30), default="Active")


class Supplier(Base):
    __tablename__ = "supplier"
    supplier_id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_name = Column(String(150), nullable=False)
    company_id = Column(Integer, ForeignKey("company.company_id", ondelete="CASCADE"), nullable=False)
    country = Column(String(100))
    lead_time_days = Column(Integer)
    reliability_score = Column(Numeric(3, 2))
    contact_email = Column(String(150))
    active_status = Column(Boolean, default=True)


class Product(Base):
    __tablename__ = "product"
    product_id = Column(Integer, primary_key=True, autoincrement=True)
    product_name = Column(String(200), nullable=False)
    supplier_id = Column(Integer, ForeignKey("supplier.supplier_id", ondelete="CASCADE"), nullable=False)
    category = Column(String(100))
    unit_price = Column(Numeric(12, 2))
    reorder_level = Column(Integer, default=10)
    weight_kg = Column(Numeric(8, 2))
    active_status = Column(Boolean, default=True)


class Warehouse(Base):
    __tablename__ = "warehouse"
    warehouse_id = Column(Integer, primary_key=True, autoincrement=True)
    warehouse_name = Column(String(150), nullable=False)
    location_city = Column(String(100))
    location_country = Column(String(100))
    capacity_units = Column(Integer)
    manager_name = Column(String(100))
    contact_number = Column(String(30))
    active_status = Column(Boolean, default=True)


class Inventory(Base):
    __tablename__ = "inventory"
    inventory_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("product.product_id", ondelete="CASCADE"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouse.warehouse_id", ondelete="CASCADE"), nullable=False)
    quantity_available = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)
    last_updated = Column(Date)
    minimum_threshold = Column(Integer, default=10)
    inventory_status = Column(String(30), default="In Stock")


class Shipment(Base):
    __tablename__ = "shipment"
    shipment_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("product.product_id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("supplier.supplier_id", ondelete="CASCADE"), nullable=False)
    quantity_shipped = Column(Integer)
    expected_delivery_date = Column(Date, nullable=False)
    actual_delivery_date = Column(Date)
    shipment_status = Column(String(30), default="In Transit")
    transport_mode = Column(String(30))


class Order(Base):
    __tablename__ = "orders"
    order_id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("company.company_id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("product.product_id", ondelete="CASCADE"), nullable=False)
    order_quantity = Column(Integer)
    order_date = Column(Date)
    expected_fulfill_date = Column(Date)
    order_status = Column(String(30), default="Pending")
    priority_level = Column(String(20), default="Medium")


class RiskEvent(Base):
    __tablename__ = "risk_event"
    risk_id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    risk_type = Column(String(50), nullable=False)
    risk_severity = Column(String(20), default="Medium")
    detected_date = Column(Date)
    description = Column(Text)
    resolution_status = Column(String(30), default="Open")
