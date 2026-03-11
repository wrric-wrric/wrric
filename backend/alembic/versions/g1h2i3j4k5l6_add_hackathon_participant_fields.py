"""Add extended hackathon participant fields

Revision ID: g1h2i3j4k5l6
Revises: e8887f1df15f
Create Date: 2026-02-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g1h2i3j4k5l6'
down_revision: Union[str, None] = 'e8887f1df15f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to hackathon_participants
    op.add_column('hackathon_participants', sa.Column('theme', sa.String(), nullable=True))
    op.add_column('hackathon_participants', sa.Column('participant_type', sa.String(), nullable=True))
    op.add_column('hackathon_participants', sa.Column('occupation', sa.String(), nullable=True))
    op.add_column('hackathon_participants', sa.Column('department', sa.String(), nullable=True))
    op.add_column('hackathon_participants', sa.Column('major', sa.String(), nullable=True))
    op.add_column('hackathon_participants', sa.Column('position', sa.String(), nullable=True))
    op.add_column('hackathon_participants', sa.Column('specialization', sa.String(), nullable=True))
    
    # Create index on participant_type for efficient filtering
    op.create_index('ix_hackathon_participants_participant_type', 'hackathon_participants', ['participant_type'])
    
    # Drop old unique constraint and create new one with participant_type
    # Note: The old constraint name may vary, using IF EXISTS for safety
    op.execute('DROP INDEX IF EXISTS ix_hackathon_participants_unique_email')
    op.create_index(
        'ix_hackathon_participants_unique_email_type',
        'hackathon_participants',
        ['hackathon_id', 'email', 'participant_type'],
        unique=True
    )


def downgrade() -> None:
    # Drop new index and recreate old one
    op.drop_index('ix_hackathon_participants_unique_email_type', table_name='hackathon_participants')
    op.create_index(
        'ix_hackathon_participants_unique_email',
        'hackathon_participants',
        ['hackathon_id', 'email'],
        unique=True
    )
    
    # Drop index on participant_type
    op.drop_index('ix_hackathon_participants_participant_type', table_name='hackathon_participants')
    
    # Remove new columns
    op.drop_column('hackathon_participants', 'specialization')
    op.drop_column('hackathon_participants', 'position')
    op.drop_column('hackathon_participants', 'major')
    op.drop_column('hackathon_participants', 'department')
    op.drop_column('hackathon_participants', 'occupation')
    op.drop_column('hackathon_participants', 'participant_type')
    op.drop_column('hackathon_participants', 'theme')
