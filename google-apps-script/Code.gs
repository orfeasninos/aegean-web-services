/**
 * Contact form handler for aegeanwebservices.gr
 *
 * Runs as the Google account that deploys it (sender = that Gmail).
 * Sends each message to ADMIN_EMAIL with Reply-To = the client, so hitting
 * Reply in the contact@ inbox answers the client directly.
 *
 * Setup:
 *   1. Create a Google Sheet → Extensions → Apps Script, paste this file.
 *   2. Run intialSetup() once (stores the Sheet id).
 *   3. Deploy → New deployment → Web app
 *        Execute as: Me    Who has access: Anyone
 *   4. Put the /exec URL in the form's action attribute in index.html.
 */

const sheetName = 'Sheet1'
const ADMIN_EMAIL = 'contact@aegeanwebservices.gr'
const HEADERS = ['Timestamp', 'Name', 'Email', 'Phone', 'Service', 'Message', 'Estimate']

const SERVICES = {
  'custom-website': 'Νέα ιστοσελίδα',
  'landing-page': 'One-pager / Landing page',
  'performance': 'Βελτίωση ταχύτητας',
  'other': 'Κάτι άλλο'
}

const scriptProp = PropertiesService.getScriptProperties()

function intialSetup () {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  scriptProp.setProperty('key', activeSpreadsheet.getId())
}

function doPost (e) {
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(10000)) {
    return json({ result: 'error', error: 'busy' })
  }

  try {
    // =========================
    // 🔐 SECURITY LAYER
    // =========================
    const data = e.parameter
    const now = new Date().getTime()
    const ts = Number(data.ts || 0)

    // 1. Honeypot (bot field)
    if (data.website && data.website.trim() !== '') {
      return reject('honeypot')
    }

    // 2. Timestamp: at least 1s since the form was opened, at most 1h old, not >5min in the future
    if (!ts || (now - ts) < 1000) {
      return reject('too_fast')
    }
    if ((ts - now) > 5 * 60 * 1000 || (now - ts) > 60 * 60 * 1000) {
      return reject('expired')
    }

    // 3. Token validation
    if (!data.token || !data.token.startsWith('aws_')) {
      return reject('invalid_token')
    }

    // 4. Rate limit per browser (fingerprint)
    const userId = String(data.user_id || 'anon').slice(0, 64)
    const key = 'rl_' + userId
    const last = Number(scriptProp.getProperty(key) || 0)
    if (now - last < 7000) {
      return reject('rate_limited')
    }
    scriptProp.setProperty(key, String(now))

    // 5. Max messages per browser per day
    const quotaKey = 'quota_' + userId
    const todayDate = new Date().toISOString().split('T')[0]
    const quotaData = JSON.parse(scriptProp.getProperty(quotaKey) || '{"date":"","count":0}')
    if (quotaData.date === todayDate) {
      if (quotaData.count >= 3) {
        return reject('quota_exceeded')
      }
      quotaData.count += 1
    } else {
      quotaData.date = todayDate
      quotaData.count = 1
    }
    scriptProp.setProperty(quotaKey, JSON.stringify(quotaData))

    // 6. Field validation (same rules as the form)
    const name = clean(data.name, 100)
    const email = clean(data.email, 200)
    const service = SERVICES[data.service] || clean(data.service, 100)
    const message = clean(data.message, 5000)
    const phone = clean(data.phone, 30)
    // Choices sent from the pricing estimator; when present the message is optional
    const estimate = clean(data.estimate, 2000)

    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reject('invalid_fields')
    }
    if (!estimate && message.length < 10) {
      return reject('invalid_fields')
    }
    if (estimate && message && message.length < 10) {
      return reject('invalid_fields')
    }
    if (phone && !/^\+?[\d\s().-]{6,30}$/.test(phone)) {
      return reject('invalid_phone')
    }

    // 7. A name never contains links or HTML
    if (name.length > 60 || /https?:|www\.|[<>]/i.test(name)) {
      return reject('invalid_name')
    }
    // =========================
    // END SECURITY LAYER
    // =========================

    // SAVE TO SHEET
    const doc = SpreadsheetApp.openById(scriptProp.getProperty('key'))
    const sheet = doc.getSheetByName(sheetName)
    // Writes (or upgrades an older) header row
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length)
    if (headerRange.getValues()[0].join('|') !== HEADERS.join('|')) {
      if (sheet.getLastRow() > 0 && sheet.getRange(1, 1).getValue() !== 'Timestamp') sheet.insertRowBefore(1)
      headerRange.setValues([HEADERS])
    }
    // Leading ' stops Sheets from running user input as a formula
    sheet.appendRow([new Date(), name, email, phone, service, message, estimate].map(v =>
      typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v))

    // EMAIL TO ME
    const safe = {
      name: escapeHtml(name),
      email: escapeHtml(email),
      phone: escapeHtml(phone),
      service: escapeHtml(service),
      message: escapeHtml(message).replace(/\n/g, '<br>'),
      estimate: escapeHtml(estimate).replace(/\n/g, '<br>')
    }

    const subject = estimate
      ? `Αίτημα προσφοράς από ${name}`
      : `Νέο μήνυμα από ${name} (${service})`

    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      replyTo: email,
      name: 'Aegean Web Services – Φόρμα',
      subject: subject,
      htmlBody: `
        <h3>${estimate ? 'Αίτημα προσφοράς από τον υπολογιστή κόστους' : 'Νέο μήνυμα από τη φόρμα επικοινωνίας'}</h3>
        <p><strong>Όνομα:</strong> ${safe.name}</p>
        <p><strong>Email:</strong> <a href="mailto:${safe.email}">${safe.email}</a></p>
        ${phone ? `<p><strong>Τηλέφωνο:</strong> <a href="tel:${safe.phone.replace(/[^\d+]/g, '')}">${safe.phone}</a></p>` : ''}
        <p><strong>Υπηρεσία:</strong> ${safe.service}</p>
        ${estimate ? `<p><strong>Επιλογές στον υπολογιστή κόστους:</strong><br>${safe.estimate}</p>` : ''}
        <p><strong>Μήνυμα:</strong><br>${safe.message || '<em>(χωρίς μήνυμα)</em>'}</p>
      `
    })

    return json({ result: 'success' })
  } catch (err) {
    console.error(err) // full error: Apps Script → Executions
    return json({ result: 'error', error: 'server_error' })
  } finally {
    lock.releaseLock()
  }
}

function reject (reason) {
  return json({ result: 'rejected', reason: reason })
}

function json (obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

function clean (value, max) {
  return String(value || '').trim().slice(0, max)
}

function escapeHtml (str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
