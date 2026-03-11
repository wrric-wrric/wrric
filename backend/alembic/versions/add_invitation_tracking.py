"""add invitation tracking fields

Revision ID: add_invitation_tracking
Revises: 32c5908b64de
Create Date: 2026-01-22 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_invitation_tracking'
down_revision: Union[str, Sequence[str], None] = '32c5908b64de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - columns already exist from other migrations."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
