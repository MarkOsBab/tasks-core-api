/**
 * Display name for comments posted by an AI agent (Comment.viaAgent): the real user stays as
 * userId for permissions/audit, but every user-facing surface (REST resource, MCP get_task,
 * notifications) signs them with this label instead of the token owner's name.
 */
export const AGENT_COMMENT_AUTHOR = 'Tasks IA';
