"""add registration password setup and anonymous fields

Revision ID: enhanced_registration_fields
Revises: 32c5908b64de
Create Date: 2026-01-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'enhanced_registration_fields'
down_revision: Union[str, Sequence[str], None] = '32c5908b64de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new columns for enhanced registration options
    op.add_column('event_registrations', sa.Column('needs_password_setup', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('event_registrations', sa.Column('password_setup_token', sa.String(length=255), nullable=True))
    op.add_column('event_registrations', sa.Column('password_setup_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('event_registrations', sa.Column('rejection_token', sa.String(length=255), nullable=True))
    op.add_column('event_registrations', sa.Column('rejection_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('event_registrations', sa.Column('is_rejected', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('event_registrations', sa.Column('is_anonymous', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('event_registrations', sa.Column('temp_user_id', sa.UUID(as_uuid=True), nullable=True))

    # Create indexes
    op.create_index(op.f('ix_event_registrations_password_setup_token'), 'event_registrations', ['password_setup_token'], unique=False)
    op.create_index(op.f('ix_event_registrations_rejection_token'), 'event_registrations', ['rejection_token'], unique=False)
    op.create_index(op.f('ix_event_registrations_temp_user_id'), 'event_registrations', ['temp_user_id'])
    
    # Add foreign key for temp_user_id if users table exists
    op.create_foreign_key(
        'fk_event_registrations_temp_user_id_users',
        'event_registrations', 'users',
        ['temp_user_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop foreign key first
    op.drop_constraint('fk_event_registrations_temp_user_id_users', 'event_registrations', type_='foreign')
    
    # Drop indexes
    op.drop_index(op.f('ix_event_registrations_temp_user_id'), table_name='event_registrations')
    op.drop_index(op.f('ix_event_registrations_rejection_token'), table_name='event_registrations')
    op.drop_index(op.f('ix_event_registrations_password_setup_token'), table_name='event_registrations')
    
    # Drop columns
    op.drop_column('event_registrations', 'temp_user_id')
    op.drop_column('event_registrations', 'is_anonymous')
    op.drop_column('event_registrations', 'is_rejected')
    op.drop_column('event_registrations', 'rejection_expires_at')
    op.drop_column('event_registrations', 'rejection_token')
    op.drop_column('event_registrations', 'password_setup_expires_at')
    op.drop_column('event_registrations', 'password_setup_token')
    op.drop_column('event_registrations', 'needs_password_setup')
