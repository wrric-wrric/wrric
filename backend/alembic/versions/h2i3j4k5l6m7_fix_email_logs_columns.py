"""Fix hackathon_email_logs missing columns

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-02-01

This migration adds any missing columns to hackathon_email_logs table
that may not have been applied from the original migration.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'h2i3j4k5l6m7'
down_revision: Union[str, None] = 'g1h2i3j4k5l6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    bind = op.get_bind()
    insp = inspect(bind)
    columns = [c['name'] for c in insp.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add missing columns to hackathon_email_logs if they don't exist
    if not column_exists('hackathon_email_logs', 'attachment_names'):
        op.add_column('hackathon_email_logs', sa.Column('attachment_names', JSONB(), server_default='[]'))
    
    if not column_exists('hackathon_email_logs', 'deleted_at'):
        op.add_column('hackathon_email_logs', sa.Column('deleted_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    # We don't remove columns in downgrade to avoid data loss
    # The columns will remain if they existed before this migration
    pass
