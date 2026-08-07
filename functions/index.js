// functions/index.js
// ---------------------------------------------------------------------------
// Cloud Function that watches the `pushQueue` Firestore collection.
// Whenever a new push-queue document is created (by StorageService when a
// NotificationItem is added), this function reads matching FCM tokens from
// `pushTokens` and sends a real push notification to each device.
//
// DEPLOY:
//   1. cd into the project root (where this `functions/` folder lives)
//   2. npm install -g firebase-tools
//   3. firebase login
//   4. firebase init functions  -> choose "Use an existing project",
//      pick your project, JavaScript, npm install
//   5. Paste this code into functions/index.js (overwrite the default)
//   6. firebase deploy --only functions
// ---------------------------------------------------------------------------

const functions = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

/**
 * Triggered whenever a new doc is written to the `pushQueue` collection.
 * Each doc shape:
 *   { id, title, message, type, targetRole, targetStudentId?, status, createdAt }
 */
exports.sendPushNotification = functions.firestore
  .onDocumentCreated('pushQueue/{notifId}', async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();

    const { title, message, targetRole, targetStudentId } = data;
    if (!title || !message) {
      console.warn('pushQueue doc missing title/message — skipping.');
      return;
    }

    // Find tokens to deliver to.
    let tokensQuery;
    if (targetRole === 'admin') {
      tokensQuery = await db.collection('pushTokens').where('role', '==', 'admin').get();
    } else if (targetStudentId) {
      tokensQuery = await db
        .collection('pushTokens')
        .where('role', '==', 'student')
        .where('studentId', '==', targetStudentId)
        .get();
    } else {
      // Broadcast to all students
      tokensQuery = await db.collection('pushTokens').where('role', '==', 'student').get();
    }

    if (tokensQuery.empty) {
      console.log('No registered FCM tokens for target — skipping push.');
      await snap.ref.update({ status: 'no_tokens', processedAt: new Date().toISOString() });
      return;
    }

    const tokens = tokensQuery.docs.map((d) => d.get('token'));
    const payload = {
      notification: {
        title,
        body: message,
        icon: '/icon-192.png',
        click_action: '/'
      },
      webpush: {
        notification: {
          title,
          body: message,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [120, 60, 120],
          tag: 'apex-push-' + (data.type || 'misc')
        }
      }
    };

    try {
      const response = await getMessaging().sendEachForMulticast({
        tokens,
        ...payload
      });
      console.log(`Push sent: ${response.successCount} success / ${response.failureCount} failure`);

      // Clean up dead tokens
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) failedTokens.push(tokens[idx]);
        });
        for (const t of failedTokens) {
          try {
            await db.collection('pushTokens').doc(t).delete();
          } catch (e) {
            // ignore
          }
        }
        console.log(`Removed ${failedTokens.length} dead tokens.`);
      }

      await snap.ref.update({
        status: 'sent',
        sentToCount: response.successCount,
        processedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('FCM send error:', err);
      await snap.ref.update({
        status: 'error',
        error: err.message,
        processedAt: new Date().toISOString()
      });
    }
  });
