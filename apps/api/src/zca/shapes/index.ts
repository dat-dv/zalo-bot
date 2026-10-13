/**
 * Central Barrel Export for all ZCA Shapes
 * Reference: https://zca-js.tdung.com/vi/get-started/introduction.html
 *
 * Categories:
 * - Enums: ThreadType, Reactions, GroupEventType, TextStyle, etc.
 * - Models: Message, Group, User, Attachment, Reaction, etc.
 * - Listeners: Events, Callbacks, Listener classes.
 * - APIs: Request parameters, payloads, and response shapes for all 80+ endpoints.
 * - Auth: Cookie, Credentials, LoginQR, Proxy, Session contexts.
 * - Guards & Transformers: Type guards and helper utilities.
 */

export * from './enums.shape';
export * from './models.shape';
export * from './listeners.shape';
export * from './apis.shape';
export * from './auth.shape';
export * from './shape-guards';
