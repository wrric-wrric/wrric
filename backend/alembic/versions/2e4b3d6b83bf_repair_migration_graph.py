"""repair migration graph

Revision ID: 2e4b3d6b83bf
Revises: d3a6f7b2c891
Create Date: 2026-01-31 08:03:02.211275

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e4b3d6b83bf'
down_revision: Union[str, Sequence[str], None] = 'd3a6f7b2c891'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
