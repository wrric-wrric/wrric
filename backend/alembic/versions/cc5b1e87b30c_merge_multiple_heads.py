"""merge multiple heads

Revision ID: cc5b1e87b30c
Revises: d4441d4861e9, g1h2i3j4k5l6
Create Date: 2026-02-01 14:42:07.152808

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cc5b1e87b30c'
down_revision: Union[str, Sequence[str], None] = ('d4441d4861e9', 'g1h2i3j4k5l6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
