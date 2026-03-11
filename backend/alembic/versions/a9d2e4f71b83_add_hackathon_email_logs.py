"""add hackathon email logs

Revision ID: a9d2e4f71b83
Revises: f3a7c2e19d84
Create Date: 2026-02-01 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = 'a9d2e4f71b83'
down_revision: Union[str, None] = 'f3a7c2e19d84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'hackathon_email_logs',
        sa.Column('id', sa.UUID(), primary_key=True),
        sa.Column('hackathon_id', sa.UUID(), sa.ForeignKey('hackathon_configs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('meeting_link', sa.String(), nullable=True),
        sa.Column('attachment_names', JSONB(), server_default='[]'),
        sa.Column('recipient_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('recipient_emails', JSONB(), server_default='[]'),
        sa.Column('sent_count', sa.Integer(), server_default='0'),
        sa.Column('failed_count', sa.Integer(), server_default='0'),
        sa.Column('sent_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('hackathon_email_logs')
