"""merged multiple heads

Revision ID: e8887f1df15f
Revises: 0cb69ea28638, add_invitation_tracking, enhanced_registration_fields
Create Date: 2026-01-24 07:18:59.764376

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8887f1df15f'
down_revision: Union[str, Sequence[str], None] = ('0cb69ea28638', 'add_invitation_tracking', 'enhanced_registration_fields')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
