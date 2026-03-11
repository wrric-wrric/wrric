"""merge multiple heads

Revision ID: 0687bce3ed63
Revises: 69af75426d53, i3j4k5l6m7n8
Create Date: 2026-02-01 16:28:30.476768

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0687bce3ed63'
down_revision: Union[str, Sequence[str], None] = ('69af75426d53', 'i3j4k5l6m7n8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
