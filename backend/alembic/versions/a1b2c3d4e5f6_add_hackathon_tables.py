"""add hackathon tables

Revision ID: a1b2c3d4e5f6
Revises: 620b65b62549
Create Date: 2026-02-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '620b65b62549'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_hackathon to events
    op.add_column('events', sa.Column('is_hackathon', sa.Boolean(), server_default='false', nullable=True))

    # hackathon_configs
    op.create_table('hackathon_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('judging_started_at', sa.DateTime(), nullable=True),
        sa.Column('judging_ended_at', sa.DateTime(), nullable=True),
        sa.Column('metadata_', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_id'),
    )
    op.create_index('ix_hackathon_configs_event_id', 'hackathon_configs', ['event_id'])

    # scoring_schemas
    op.create_table('scoring_schemas',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('hackathon_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('version', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('is_locked', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['hackathon_id'], ['hackathon_configs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hackathon_id'),
    )
    op.create_index('ix_scoring_schemas_hackathon_id', 'scoring_schemas', ['hackathon_id'])

    # scoring_criteria
    op.create_table('scoring_criteria',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('schema_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('weight', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('min_score', sa.Float(), nullable=False, server_default='0'),
        sa.Column('max_score', sa.Float(), nullable=False, server_default='10'),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('rubric', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['schema_id'], ['scoring_schemas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_scoring_criteria_schema_id', 'scoring_criteria', ['schema_id'])

    # hackathon_participants
    op.create_table('hackathon_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('hackathon_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('upload_batch_id', sa.String(), nullable=True),
        sa.Column('first_name', sa.String(), nullable=False),
        sa.Column('last_name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('organization', sa.String(), nullable=True),
        sa.Column('team_name', sa.String(), nullable=True),
        sa.Column('project_title', sa.String(), nullable=True),
        sa.Column('project_description', sa.Text(), nullable=True),
        sa.Column('metadata_', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['hackathon_id'], ['hackathon_configs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_hackathon_participants_hackathon_id', 'hackathon_participants', ['hackathon_id'])
    op.create_index('ix_hackathon_participants_email', 'hackathon_participants', ['email'])
    op.create_index('ix_hackathon_participants_upload_batch_id', 'hackathon_participants', ['upload_batch_id'])
    op.create_index('ix_hackathon_participants_unique_email', 'hackathon_participants', ['hackathon_id', 'email'], unique=True)

    # hackathon_judges
    op.create_table('hackathon_judges',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('hackathon_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('display_name', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['hackathon_id'], ['hackathon_configs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_hackathon_judges_hackathon_id', 'hackathon_judges', ['hackathon_id'])
    op.create_index('ix_hackathon_judges_user_id', 'hackathon_judges', ['user_id'])
    op.create_index('ix_hackathon_judges_unique', 'hackathon_judges', ['hackathon_id', 'user_id'], unique=True)

    # judge_assignments
    op.create_table('judge_assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('judge_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('participant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['judge_id'], ['hackathon_judges.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['participant_id'], ['hackathon_participants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_judge_assignments_judge_id', 'judge_assignments', ['judge_id'])
    op.create_index('ix_judge_assignments_participant_id', 'judge_assignments', ['participant_id'])
    op.create_index('ix_judge_assignments_unique', 'judge_assignments', ['judge_id', 'participant_id'], unique=True)

    # participant_scores
    op.create_table('participant_scores',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('participant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('judge_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('criterion_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('is_draft', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['participant_id'], ['hackathon_participants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['judge_id'], ['hackathon_judges.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['criterion_id'], ['scoring_criteria.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_participant_scores_participant_id', 'participant_scores', ['participant_id'])
    op.create_index('ix_participant_scores_judge_id', 'participant_scores', ['judge_id'])
    op.create_index('ix_participant_scores_criterion_id', 'participant_scores', ['criterion_id'])
    op.create_index('ix_participant_scores_unique', 'participant_scores', ['participant_id', 'judge_id', 'criterion_id'], unique=True)


def downgrade() -> None:
    op.drop_table('participant_scores')
    op.drop_table('judge_assignments')
    op.drop_table('hackathon_judges')
    op.drop_table('hackathon_participants')
    op.drop_table('scoring_criteria')
    op.drop_table('scoring_schemas')
    op.drop_table('hackathon_configs')
    op.drop_column('events', 'is_hackathon')
