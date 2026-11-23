import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  avatarColor: text('avatar_color').notNull().default('#4285F4'),
  preferredEngine: text('preferred_engine').notNull().default('hybrid'),
  theme: text('theme').notNull().default('light'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const searchHistory = pgTable('search_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  query: text('query').notNull(),
  engineMode: text('engine_mode').notNull().default('hybrid'),
  tab: text('tab').notNull().default('all'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bookmarks = pgTable('bookmarks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  snippet: text('snippet').notNull().default(''),
  displayLink: text('display_link').notNull().default(''),
  sourceType: text('source_type').notNull().default('google'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shortcuts = pgTable('shortcuts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  iconColor: text('icon_color').notNull().default('#4285F4'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  searchHistory: many(searchHistory),
  bookmarks: many(bookmarks),
  shortcuts: many(shortcuts),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
}));

export const shortcutsRelations = relations(shortcuts, ({ one }) => ({
  user: one(users, {
    fields: [shortcuts.userId],
    references: [users.id],
  }),
}));
