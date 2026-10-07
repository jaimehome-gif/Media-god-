import './better-auth.C24Bzw4w.mjs';
import './better-auth.8zoxzg-F.mjs';
import { g as generateId } from './better-auth.BUPPRXfK.mjs';
import 'zod';
import 'better-call';
import '@better-auth/utils/hash';
import '@noble/ciphers/chacha';
import '@noble/ciphers/utils';
import '@noble/ciphers/webcrypto';
import '@better-auth/utils/base64';
import 'jose';
import '@noble/hashes/scrypt';
import '@better-auth/utils';
import '@better-auth/utils/hex';
import '@noble/hashes/utils';
import './better-auth.B4Qoxdgc.mjs';
import './better-auth.DH3YjMQH.mjs';
import { g as getAuthTables } from './better-auth.DORkW_Ge.mjs';
import 'kysely';
import { w as withApplyDefault } from './better-auth.0TC26uRi.mjs';

const createTransform = (options) => {
  const schema = getAuthTables(options);
  function getField(model, field) {
    if (field === "id") {
      return field;
    }
    const f = schema[model].fields[field];
    return f.fieldName || field;
  }
  return {
    transformInput(data, model, action) {
      const transformedData = action === "update" ? {} : {
        id: options.advanced?.generateId ? options.advanced.generateId({
          model
        }) : data.id || generateId()
      };
      const fields = schema[model].fields;
      for (const field in fields) {
        const value = data[field];
        if (value === void 0 && !fields[field].defaultValue) {
          continue;
        }
        transformedData[fields[field].fieldName || field] = withApplyDefault(
          value,
          fields[field],
          action
        );
      }
      return transformedData;
    },
    transformOutput(data, model, select = []) {
      if (!data) return null;
      const transformedData = data.id || data._id ? select.length === 0 || select.includes("id") ? {
        id: data.id
      } : {} : {};
      const tableSchema = schema[model].fields;
      for (const key in tableSchema) {
        if (select.length && !select.includes(key)) {
          continue;
        }
        const field = tableSchema[key];
        if (field) {
          transformedData[key] = data[field.fieldName || key];
        }
      }
      return transformedData;
    },
    convertWhereClause(where, table, model) {
      return table.filter((record) => {
        return where.every((clause) => {
          const { field: _field, value, operator } = clause;
          const field = getField(model, _field);
          if (operator === "in") {
            if (!Array.isArray(value)) {
              throw new Error("Value must be an array");
            }
            return value.includes(record[field]);
          } else if (operator === "contains") {
            return record[field].includes(value);
          } else if (operator === "starts_with") {
            return record[field].startsWith(value);
          } else if (operator === "ends_with") {
            return record[field].endsWith(value);
          } else {
            return record[field] === value;
          }
        });
      });
    },
    getField
  };
};
const memoryAdapter = (db) => (options) => {
  const { transformInput, transformOutput, convertWhereClause, getField } = createTransform(options);
  return {
    id: "memory",
    create: async ({ model, data }) => {
      const transformed = transformInput(data, model, "create");
      db[model].push(transformed);
      return transformOutput(transformed, model);
    },
    findOne: async ({ model, where, select }) => {
      const table = db[model];
      const res = convertWhereClause(where, table, model);
      const record = res[0] || null;
      return transformOutput(record, model, select);
    },
    findMany: async ({ model, where, sortBy, limit, offset }) => {
      let table = db[model];
      if (where) {
        table = convertWhereClause(where, table, model);
      }
      if (sortBy) {
        table = table.sort((a, b) => {
          const field = getField(model, sortBy.field);
          if (sortBy.direction === "asc") {
            return a[field] > b[field] ? 1 : -1;
          } else {
            return a[field] < b[field] ? 1 : -1;
          }
        });
      }
      if (offset !== void 0) {
        table = table.slice(offset);
      }
      if (limit !== void 0) {
        table = table.slice(0, limit);
      }
      return table.map((record) => transformOutput(record, model));
    },
    count: async ({ model }) => {
      return db[model].length;
    },
    update: async ({ model, where, update }) => {
      const table = db[model];
      const res = convertWhereClause(where, table, model);
      res.forEach((record) => {
        Object.assign(record, transformInput(update, model, "update"));
      });
      return transformOutput(res[0], model);
    },
    delete: async ({ model, where }) => {
      const table = db[model];
      const res = convertWhereClause(where, table, model);
      db[model] = table.filter((record) => !res.includes(record));
    },
    deleteMany: async ({ model, where }) => {
      const table = db[model];
      const res = convertWhereClause(where, table, model);
      let count = 0;
      db[model] = table.filter((record) => {
        if (res.includes(record)) {
          count++;
          return false;
        }
        return !res.includes(record);
      });
      return count;
    },
    updateMany(data) {
      const { model, where, update } = data;
      const table = db[model];
      const res = convertWhereClause(where, table, model);
      res.forEach((record) => {
        Object.assign(record, update);
      });
      return res[0] || null;
    }
  };
};

export { memoryAdapter as m };
