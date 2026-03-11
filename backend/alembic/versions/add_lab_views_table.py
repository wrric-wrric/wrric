"""add lab_views table

Revision ID: d3a6f7b2c891
Revises: bbf52a549e23
Create Date: 2026-01-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd3a6f7b2c891'
down_revision: Union[str, Sequence[str], None] = 'bbf52a549e23'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'lab_views',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('view_date', sa.Date(), nullable=False),
    )
    op.create_index('ix_lab_views_entity_id', 'lab_views', ['entity_id'])
    op.create_index('ix_lab_views_unique', 'lab_views', ['entity_id', 'user_id', 'view_date'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_lab_views_unique', table_name='lab_views')
    op.drop_index('ix_lab_views_entity_id', table_name='lab_views')
    op.drop_table('lab_views')
