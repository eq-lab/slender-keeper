import Database from 'better-sqlite3';

const db = new Database('db.sqlite',);

db.prepare('CREATE TABLE IF NOT EXISTS ledger(last_synced UNSIGNED BIG INT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS users(user TEXT, UNIQUE(user))').run();

const userInsert = db.prepare('INSERT OR IGNORE INTO users(user) VALUES (?)');

export const getLastSyncedLedger = () => {
    let lastSyncedLedger = db.prepare('SELECT last_synced from ledger').pluck().get();
    if (lastSyncedLedger === undefined) {
        // init row with rowid = 0
        lastSyncedLedger = 0;
        db.prepare('INSERT INTO ledger VALUES (?)').run(lastSyncedLedger);
    }
    return lastSyncedLedger;
}


export const writeLastSyncedLedger = (lastSyncedLedger: number) => {
    db.prepare('UPDATE ledger SET last_synced=(?) WHERE rowid=1').run(lastSyncedLedger);
}

export const getUsers = () => db.prepare('SELECT user from users').get() || []

export const writeUsers = (users: string[]) => {
    for (const user of users) {
        userInsert.run(user);
    }
}

export const removeUser = (user: string) => {
    db.prepare('DELETE FROM users WHERE user=(?)').run(user);
}

process.on('exit', () => db.close());