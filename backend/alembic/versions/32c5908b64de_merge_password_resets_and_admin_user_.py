"""merge password resets and admin user changes

Revision ID: 32c5908b64de
Revises: fee3eb6e27ff, b2match123456
Create Date: 2026-01-18 12:44:32.049086

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '32c5908b64de'
down_revision: Union[str, Sequence[str], None] = ('fee3eb6e27ff', 'b2match123456')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
