import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { bookmarks, searchHistory, shortcuts, users } from './schema.ts';

export async function getOrCreateUser(params: {
  uid: string;
  email: string;
  displayName?: string;
  avatarColor?: string;
  preferredEngine?: string;
  theme?: string;
}) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: params.email,
        displayName: params.displayName || params.email.split('@')[0] || 'مستخدم نوفا',
        avatarColor: params.avatarColor || '#4285F4',
        preferredEngine: params.preferredEngine || 'hybrid',
        theme: params.theme || 'light',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: params.email,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('تعذر مزامنة ملف المستخدم في قاعدة البيانات.', { cause: error });
  }
}

export async function updateUserPreferences(
  uid: string,
  updates: { preferredEngine?: string; theme?: string; displayName?: string; avatarColor?: string }
) {
  try {
    const result = await db
      .update(users)
      .set({
        ...(updates.preferredEngine ? { preferredEngine: updates.preferredEngine } : {}),
        ...(updates.theme ? { theme: updates.theme } : {}),
        ...(updates.displayName ? { displayName: updates.displayName } : {}),
        ...(updates.avatarColor ? { avatarColor: updates.avatarColor } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.uid, uid))
      .returning();

    return result[0] || null;
  } catch (error) {
    console.error('Database query failed in updateUserPreferences:', error);
    throw new Error('تعذر تحديث تفضيلات المستخدم.', { cause: error });
  }
}

export async function getUserHistory(uid: string) {
  try {
    return await db
      .select({
        id: searchHistory.id,
        query: searchHistory.query,
        engineMode: searchHistory.engineMode,
        tab: searchHistory.tab,
        createdAt: searchHistory.createdAt,
      })
      .from(searchHistory)
      .innerJoin(users, eq(searchHistory.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(searchHistory.createdAt))
      .limit(30);
  } catch (error) {
    console.error('Database query failed in getUserHistory:', error);
    throw new Error('تعذر جلب سجل البحث.', { cause: error });
  }
}

export async function addHistoryEntry(
  uid: string,
  email: string,
  entry: { query: string; engineMode: string; tab: string }
) {
  try {
    const user = await getOrCreateUser({ uid, email });
    const inserted = await db
      .insert(searchHistory)
      .values({
        userId: user.id,
        query: entry.query.slice(0, 500),
        engineMode: entry.engineMode.slice(0, 32),
        tab: entry.tab.slice(0, 32),
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in addHistoryEntry:', error);
    throw new Error('تعذر حفظ استعلام البحث.', { cause: error });
  }
}

export async function clearUserHistory(uid: string) {
  try {
    const existingUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!existingUser.length) return;
    await db.delete(searchHistory).where(eq(searchHistory.userId, existingUser[0].id));
  } catch (error) {
    console.error('Database query failed in clearUserHistory:', error);
    throw new Error('تعذر مسح سجل البحث.', { cause: error });
  }
}

export async function getUserBookmarks(uid: string) {
  try {
    return await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        url: bookmarks.url,
        snippet: bookmarks.snippet,
        displayLink: bookmarks.displayLink,
        sourceType: bookmarks.sourceType,
        createdAt: bookmarks.createdAt,
      })
      .from(bookmarks)
      .innerJoin(users, eq(bookmarks.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(bookmarks.createdAt))
      .limit(100);
  } catch (error) {
    console.error('Database query failed in getUserBookmarks:', error);
    throw new Error('تعذر جلب المفضلة.', { cause: error });
  }
}

export async function addBookmarkEntry(
  uid: string,
  email: string,
  entry: { title: string; url: string; snippet: string; displayLink: string; sourceType: string }
) {
  try {
    const user = await getOrCreateUser({ uid, email });
    const existing = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.url, entry.url)))
      .limit(1);
    if (existing.length) return existing[0];

    const inserted = await db
      .insert(bookmarks)
      .values({
        userId: user.id,
        title: entry.title.slice(0, 300),
        url: entry.url.slice(0, 2000),
        snippet: entry.snippet.slice(0, 1000),
        displayLink: entry.displayLink.slice(0, 256),
        sourceType: entry.sourceType.slice(0, 32),
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in addBookmarkEntry:', error);
    throw new Error('تعذر إضافة النتيجة إلى المفضلة.', { cause: error });
  }
}

export async function removeBookmarkEntry(uid: string, url: string) {
  try {
    const existingUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!existingUser.length) return;
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, existingUser[0].id), eq(bookmarks.url, url)));
  } catch (error) {
    console.error('Database query failed in removeBookmarkEntry:', error);
    throw new Error('تعذر إزالة النتيجة من المفضلة.', { cause: error });
  }
}

export async function getUserShortcuts(uid: string) {
  try {
    return await db
      .select({
        id: shortcuts.id,
        title: shortcuts.title,
        url: shortcuts.url,
        iconColor: shortcuts.iconColor,
        createdAt: shortcuts.createdAt,
      })
      .from(shortcuts)
      .innerJoin(users, eq(shortcuts.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(shortcuts.id)
      .limit(12);
  } catch (error) {
    console.error('Database query failed in getUserShortcuts:', error);
    throw new Error('تعذر جلب الاختصارات.', { cause: error });
  }
}

export async function addShortcutEntry(
  uid: string,
  email: string,
  entry: { title: string; url: string; iconColor: string }
) {
  try {
    const user = await getOrCreateUser({ uid, email });
    const inserted = await db
      .insert(shortcuts)
      .values({
        userId: user.id,
        title: entry.title.slice(0, 80),
        url: entry.url.slice(0, 1000),
        iconColor: entry.iconColor.slice(0, 32),
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in addShortcutEntry:', error);
    throw new Error('تعذر إضافة الاختصار.', { cause: error });
  }
}

export async function removeShortcutEntry(uid: string, id: number) {
  try {
    const existingUser = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!existingUser.length) return;
    await db
      .delete(shortcuts)
      .where(and(eq(shortcuts.userId, existingUser[0].id), eq(shortcuts.id, id)));
  } catch (error) {
    console.error('Database query failed in removeShortcutEntry:', error);
    throw new Error('تعذر حذف الاختصار.', { cause: error });
  }
}
