"""merge multiple heads

Revision ID: d4441d4861e9
Revises: 0590bea79229, a9d2e4f71b83
Create Date: 2026-02-01 14:03:19.247057

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4441d4861e9'
down_revision: Union[str, Sequence[str], None] = ('0590bea79229', 'a9d2e4f71b83')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
