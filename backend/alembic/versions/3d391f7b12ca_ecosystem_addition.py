"""ecosystem addition

Revision ID: 3d391f7b12ca
Revises: e8ceca8b5450
Create Date: 2026-01-31 12:11:59.332561

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3d391f7b12ca'
down_revision: Union[str, Sequence[str], None] = 'e8ceca8b5450'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
