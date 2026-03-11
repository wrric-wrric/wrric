"""Add hackathon categories, judge groups, and leaderboard phase

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-02-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = 'i3j4k5l6m7n8'
down_revision = 'h2i3j4k5l6m7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add leaderboard_phase to hackathon_configs
    op.add_column('hackathon_configs', sa.Column('leaderboard_phase', sa.String(), server_default='hidden', nullable=False))
    
    # Create hackathon_categories table
    op.create_table(
        'hackathon_categories',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('hackathon_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_configs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category_type', sa.String(), nullable=True, index=True),
        sa.Column('metadata_', JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_hackathon_categories_unique_name', 'hackathon_categories', ['hackathon_id', 'name'], unique=True)
    
    # Create category_participant_memberships table
    op.create_table(
        'category_participant_memberships',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_categories.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('participant_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_participants.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('assigned_via_email_log_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_email_logs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_category_participant_unique', 'category_participant_memberships', ['category_id', 'participant_id'], unique=True)
    
    # Create category_judge_memberships table
    op.create_table(
        'category_judge_memberships',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_categories.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('judge_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_judges.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('assigned_via_email_log_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_email_logs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_category_judge_unique', 'category_judge_memberships', ['category_id', 'judge_id'], unique=True)
    
    # Create judge_groups table
    op.create_table(
        'judge_groups',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('hackathon_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_configs.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_judge_groups_unique_name', 'judge_groups', ['hackathon_id', 'name'], unique=True)
    
    # Create judge_group_memberships table
    op.create_table(
        'judge_group_memberships',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('group_id', UUID(as_uuid=True), sa.ForeignKey('judge_groups.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('judge_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_judges.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_judge_group_membership_unique', 'judge_group_memberships', ['group_id', 'judge_id'], unique=True)
    
    # Add category_id and recipient_type to hackathon_email_logs
    op.add_column('hackathon_email_logs', sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('hackathon_categories.id', ondelete='SET NULL'), nullable=True, index=True))
    op.add_column('hackathon_email_logs', sa.Column('recipient_type', sa.String(), server_default='participant', nullable=False))
    
    # Add judge_group_id to participant_scores
    op.add_column('participant_scores', sa.Column('judge_group_id', UUID(as_uuid=True), sa.ForeignKey('judge_groups.id', ondelete='SET NULL'), nullable=True, index=True))


def downgrade() -> None:
    # Remove judge_group_id from participant_scores
    op.drop_column('participant_scores', 'judge_group_id')
    
    # Remove category_id and recipient_type from hackathon_email_logs
    op.drop_column('hackathon_email_logs', 'recipient_type')
    op.drop_column('hackathon_email_logs', 'category_id')
    
    # Drop judge_group_memberships
    op.drop_index('ix_judge_group_membership_unique', 'judge_group_memberships')
    op.drop_table('judge_group_memberships')
    
    # Drop judge_groups
    op.drop_index('ix_judge_groups_unique_name', 'judge_groups')
    op.drop_table('judge_groups')
    
    # Drop category_judge_memberships
    op.drop_index('ix_category_judge_unique', 'category_judge_memberships')
    op.drop_table('category_judge_memberships')
    
    # Drop category_participant_memberships
    op.drop_index('ix_category_participant_unique', 'category_participant_memberships')
    op.drop_table('category_participant_memberships')
    
    # Drop hackathon_categories
    op.drop_index('ix_hackathon_categories_unique_name', 'hackathon_categories')
    op.drop_table('hackathon_categories')
    
    # Remove leaderboard_phase from hackathon_configs
    op.drop_column('hackathon_configs', 'leaderboard_phase')
