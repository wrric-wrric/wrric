"""add participant timezone fields

Revision ID: f3a7c2e19d84
Revises: b6ce2976e64d
Create Date: 2026-02-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a7c2e19d84'
down_revision: Union[str, None] = 'b6ce2976e64d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('hackathon_participants', sa.Column('phone_number', sa.String(), nullable=True))
    op.add_column('hackathon_participants', sa.Column('country', sa.String(), nullable=True))
    op.add_column('hackathon_participants', sa.Column('timezone', sa.String(), nullable=True))
    op.create_index('ix_hackathon_participants_country', 'hackathon_participants', ['country'])
    op.create_index('ix_hackathon_participants_timezone', 'hackathon_participants', ['timezone'])


def downgrade() -> None:
    op.drop_index('ix_hackathon_participants_timezone', table_name='hackathon_participants')
    op.drop_index('ix_hackathon_participants_country', table_name='hackathon_participants')
    op.drop_column('hackathon_participants', 'timezone')
    op.drop_column('hackathon_participants', 'country')
    op.drop_column('hackathon_participants', 'phone_number')
