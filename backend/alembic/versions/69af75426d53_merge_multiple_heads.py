"""merge multiple heads

Revision ID: 69af75426d53
Revises: cc5b1e87b30c, h2i3j4k5l6m7
Create Date: 2026-02-01 14:58:57.667849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '69af75426d53'
down_revision: Union[str, Sequence[str], None] = ('cc5b1e87b30c', 'h2i3j4k5l6m7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
