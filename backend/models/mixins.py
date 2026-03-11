# models/mixins.py
from datetime import datetime
from sqlalchemy import Column, DateTime, func
from sqlalchemy.ext.declarative import declared_attr

class TimestampMixin:
    """Reusable mixin for created_at, updated_at, deleted_at fields."""

    @declared_attr
    def created_at(cls):
        return Column(DateTime, default=datetime.utcnow, nullable=False, server_default=func.now())

    @declared_attr
    def updated_at(cls):
        return Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    @declared_attr
    def deleted_at(cls):
        return Column(DateTime, nullable=True)
