import { Address, xdr } from '@stellar/stellar-sdk';
import { bufToBigint } from 'bigint-conversion';

type ElementType<T> = T extends Array<infer U> ? U : never;
type KeyType<T> = T extends Map<infer K, unknown> ? K : never;
type ValueType<T> = T extends Map<unknown, infer V> ? V : never;

export const convertScvToJs = <T>(val: xdr.ScVal): T => {
    switch (val?.switch()) {
        case xdr.ScValType.scvBool(): {
            return val.b() as unknown as T;
        }
        case xdr.ScValType.scvVoid():
        case undefined: {
            return undefined;
        }
        case xdr.ScValType.scvU32(): {
            return val.u32() as unknown as T;
        }
        case xdr.ScValType.scvI32(): {
            return val.i32() as unknown as T;
        }
        case xdr.ScValType.scvU64():
        case xdr.ScValType.scvI64():
        case xdr.ScValType.scvU128():
        case xdr.ScValType.scvI128():
        case xdr.ScValType.scvU256():
        case xdr.ScValType.scvI256(): {
            return convertScvToBigInt(val) as unknown as T;
        }
        case xdr.ScValType.scvAddress(): {
            return Address.fromScVal(val).toString() as unknown as T;
        }
        case xdr.ScValType.scvString(): {
            return val.str().toString() as unknown as T;
        }
        case xdr.ScValType.scvSymbol(): {
            return val.sym().toString() as unknown as T;
        }
        case xdr.ScValType.scvBytes(): {
            return val.bytes() as unknown as T;
        }
        case xdr.ScValType.scvVec(): {
            type Element = ElementType<T>;
            return val.vec().map((v) => convertScvToJs<Element>(v)) as unknown as T;
        }
        case xdr.ScValType.scvMap(): {
            type Key = KeyType<T>;
            type Value = ValueType<T>;
            const res: unknown = {};
            val.map().forEach((e) => {
                const key = convertScvToJs<Key>(e.key());
                let value;
                const v: xdr.ScVal = e.val();

                switch (v?.switch()) {
                    case xdr.ScValType.scvMap(): {
                        const inner_map = new Map() as Map<unknown, unknown>;
                        v.map().forEach((e) => {
                            const key = convertScvToJs<Key>(e.key());
                            const value = convertScvToJs<Value>(e.val());
                            inner_map.set(key, value);
                        });
                        value = inner_map;
                        break;
                    }
                    default: {
                        value = convertScvToJs<Value>(e.val());
                    }
                }

                res[key as Key] = value as Value;
            });
            return res as unknown as T;
        }
        case xdr.ScValType.scvLedgerKeyNonce():
            return val.nonceKey() as unknown as T;
        case xdr.ScValType.scvTimepoint():
            return val.timepoint() as unknown as T;
        case xdr.ScValType.scvDuration():
            return val.duration() as unknown as T;

        default: {
            throw new Error(`type not implemented yet: ${val?.switch().name}`);
        }
    }
};

const convertScvToBigInt = (scval: xdr.ScVal | undefined): bigint => {
    switch (scval?.switch()) {
        case undefined: {
            return undefined;
        }
        case xdr.ScValType.scvU64(): {
            const { high, low } = scval.u64();
            return bufToBigint(new Uint32Array([high, low]));
        }
        case xdr.ScValType.scvI64(): {
            const { high, low } = scval.i64();
            return bufToBigint(new Int32Array([high, low]));
        }
        case xdr.ScValType.scvU128(): {
            const parts = scval.u128();
            const a = parts.hi();
            const b = parts.lo();
            return bufToBigint(new Uint32Array([a.high, a.low, b.high, b.low]));
        }
        case xdr.ScValType.scvI128(): {
            const parts = scval.i128();
            return BigInt(parts.lo().toString()) | (BigInt(parts.hi().toString()) << BigInt(64));
        }
        default: {
            throw new Error(`Invalid type for scvalToBigInt: ${scval?.switch().name}`);
        }
    }
};
