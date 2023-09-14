import Database from 'better-sqlite3';

const db = new Database('db.sqlite',);

db.prepare('CREATE TABLE IF NOT EXISTS ledger(last_synced UNSIGNED BIG INT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS borrowers(borrower TEXT, UNIQUE(borrower))').run();

const borrowerInsert = db.prepare('INSERT OR IGNORE INTO borrowers(borrower) VALUES (?)');
const borrowerDelete = db.prepare('DELETE FROM borrowers WHERE borrower=(?)');

export const readLastSyncedLedger = () => {
    let lastSyncedLedger = db.prepare('SELECT last_synced from ledger').pluck().get();
    if (lastSyncedLedger === undefined) {
        // init row with rowid = 0
        lastSyncedLedger = 0;
        db.prepare('INSERT INTO ledger VALUES (?)').run(lastSyncedLedger);
    }
    return lastSyncedLedger;
}


export const insertLastSyncedLedger = (lastSyncedLedger: number) => {
    db.prepare('UPDATE ledger SET last_synced=(?) WHERE rowid=1').run(lastSyncedLedger);
}

export const readBorrowers = () => db.prepare('SELECT borrower from borrowers').get() || []

export const insertBorrowers = (borrowers: string[]) => {
    for (const borrower of borrowers) {
        borrowerInsert.run(borrower);
    }
}

export const deleteBorrower = (borrower: string) => {
    borrowerDelete.run(borrower);
}

export const deleteBorrowers = (borrowers: string[]) => {
    for (const borrower of borrowers) {
        borrowerDelete.run(borrower);
    }
}

process.on('exit', () => db.close());