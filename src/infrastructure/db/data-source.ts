import "reflect-metadata"
import { DataSource } from "typeorm"
import { SlenderKeeperState } from "./entity/SlenderKeeperState"
import { SlenderBorrower } from "./entity/SlenderBorrowers"
import { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME } from '../../configuration';

export const AppDataSource = new DataSource({
    type: "mssql",
    host: DB_HOST,
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_NAME,
    synchronize: false,
    logging: false,
    entities: [SlenderKeeperState, SlenderBorrower],
    migrations: [],
    subscribers: [],
    options: {
        encrypt: false
    }
});

process.on('exit', () => AppDataSource.destroy());