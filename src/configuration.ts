import { config } from 'dotenv';

config();

export const POOL_PRECISION_FACTOR = 1_000_000_000;
export const CONTRACT_CREATION_LEDGER = process.env.CONTRACT_CREATION_LEDGER || 753012;
export const POOL_ID = process.env.POOL_ID || "CCR254VF53IMGX36QVN4ZJOKR6GK3KQJD6BJISX7LE7TXPKQEUV3MFUB";
export const SOROBAN_URL = process.env.SOROBAN_URL || "https://rpc-futurenet.stellar.org";
export const HORIZON_URL = process.env.HORIZON_URL || "https://horizon-futurenet.stellar.org";
export const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || "Test SDF Future Network ; October 2022";
export const LIQUIDATOR_ADDRESS = process.env.LIQUIDATOR_ADDRESS;
export const LIQUIDATOR_SECRET = process.env.LIQUIDATOR_SECRET;
export const POOL_ASSETS = process.env.POOL_ASSETS || "CB3VNKT7UEAHHETRHPC3XEAE3SRSVIASUG3P6KG5JFVY6Q5SVISJH2EJ,CC3OEW3BQUUMRWGPDKYESZAOXEOPBLDHKMZR2JYNHR23LIF2ULQVCAUG,CB2O6IY6EVBWFCFKAI2FNWTAYOB4RASUTYPC6VWKQ6IN44VASBQOMWKY";
export const DB_HOST = process.env.DB_HOST;
export const DB_USERNAME = process.env.DB_USERNAME;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const DB_NAME = process.env.DB_NAME;
export const CHAIN = process.env.CHAIN;