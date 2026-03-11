"""adding lat and log to patners

Revision ID: 7fe6839183b9
Revises: 3d391f7b12ca
Create Date: 2026-01-31 15:32:48.633808

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7fe6839183b9'
down_revision: Union[str, Sequence[str], None] = '3d391f7b12ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
