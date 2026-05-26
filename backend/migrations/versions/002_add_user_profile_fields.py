"""add user profile fields and connected accounts

Revision ID: 002
Revises: 001
Create Date: 2025-05-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add profile columns to users table
    op.add_column('users', sa.Column('full_name', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('phone', sa.String(50), nullable=True))
    op.add_column('users', sa.Column('country', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(500), nullable=True))

    # Create connected_accounts table
    op.create_table(
        'connected_accounts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('provider_user_id', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=True),
        sa.Column('refresh_token', sa.Text(), nullable=True),
        sa.Column('connected_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('last_synced_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_connected_account_user', 'connected_accounts', ['user_id', 'provider'])


def downgrade() -> None:
    op.drop_index('idx_connected_account_user', table_name='connected_accounts')
    op.drop_table('connected_accounts')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'date_of_birth')
    op.drop_column('users', 'country')
    op.drop_column('users', 'phone')
    op.drop_column('users', 'full_name')
