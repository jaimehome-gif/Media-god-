'use strict';

const kysely = require('kysely');
require('./better-auth.CHyZMcYK.cjs');
require('./better-auth.DiSjtgs9.cjs');
const id = require('./better-auth.Bg6iw3ig.cjs');
require('zod');
require('better-call');
require('@better-auth/utils/hash');
require('@noble/ciphers/chacha');
require('@noble/ciphers/utils');
require('@noble/ciphers/webcrypto');
require('@better-auth/utils/base64');
require('jose');
require('@noble/hashes/scrypt');
require('@better-auth/utils');
require('@better-auth/utils/hex');
require('@noble/hashes/utils');
require('./better-auth.CYeOI8C-.cjs');
require('./better-auth.GpOOav9x.cjs');
const getTables = require('./better-auth.BEphVDyL.cjs');
const utils = require('./better-auth.CUdxApHl.cjs');

function getDatabaseType(db) {
  if (!db) {
    return null;
  }
  if ("dialect" in db) {
    return getDatabaseType(db.dialect);
  }
  if ("createDriver" in db) {
    if (db instanceof kysely.SqliteDialect) {
      return "sqlite";
    }
    if (db instanceof kysely.MysqlDialect) {
      return "mysql";
    }
    if (db instanceof kysely.PostgresDialect) {
      return "postgres";
    }
    if (db instanceof kysely.MssqlDialect) {
      return "mssql";
    }
  }
  if ("aggregate" in db) {
    return "sqlite";
  }
  if ("getConnection" in db) {
    return "mysql";
  }
  if ("connect" in db) {
    return "postgres";
  }
  return null;
}
const createKyselyAdapter = async (config) => {
  const db = config.database;
  if (!db) {
    return {
      kysely: null,
      databaseType: null
    };
  }
  if ("db" in db) {
    return {
      kysely: db.db,
      databaseType: db.type
    };
  }
  if ("dialect" in db) {
    return {
      kysely: new kysely.Kysely({ dialect: db.dialect }),
      databaseType: db.type
    };
  }
  let dialect = void 0;
  const databaseType = getDatabaseType(db);
  if ("createDriver" in db) {
    dialect = db;
  }
  if ("aggregate" in db) {
    dialect = new kysely.SqliteDialect({
      database: db
    });
  }
  if ("getConnection" in db) {
    dialect = new kysely.MysqlDialect(db);
  }
  if ("connect" in db) {
    dialect = new kysely.PostgresDialect({
      pool: db
    });
  }
  return {
    kysely: dialect ? new kysely.Kysely({ dialect }) : null,
    databaseType
  };
};

const createTransform = (db, options, config) => {
  const schema = getTables.getAuthTables(options);
  function getField(model, field) {
    if (field === "id") {
      return field;
    }
    const f = schema[model].fields[field];
    if (!f) {
      console.log("Field not found", model, field);
    }
    return f.fieldName || field;
  }
  function transformValueToDB(value, model, field) {
    if (field === "id") {
      return value;
    }
    const { type = "sqlite" } = config || {};
    const f = schema[model].fields[field];
    if (f.type === "boolean" && (type === "sqlite" || type === "mssql") && value !== null && value !== void 0) {
      return value ? 1 : 0;
    }
    if (f.type === "date" && value && value instanceof Date) {
      return type === "sqlite" ? value.toISOString() : value;
    }
    return value;
  }
  function transformValueFromDB(value, model, field) {
    const { type = "sqlite" } = config || {};
    const f = schema[model].fields[field];
    if (f.type === "boolean" && (type === "sqlite" || type === "mssql") && value !== null) {
      return value === 1;
    }
    if (f.type === "date" && value) {
      return new Date(value);
    }
    return value;
  }
  function getModelName(model) {
    return schema[model].modelName;
  }
  const useDatabaseGeneratedId = options?.advanced?.generateId === false;
  return {
    transformInput(data, model, action) {
      const transformedData = useDatabaseGeneratedId || action === "update" ? {} : {
        id: options.advanced?.generateId ? options.advanced.generateId({
          model
        }) : data.id || id.generateId()
      };
      const fields = schema[model].fields;
      for (const field in fields) {
        const value = data[field];
        transformedData[fields[field].fieldName || field] = utils.withApplyDefault(
          transformValueToDB(value, model, field),
          fields[field],
          action
        );
      }
      return transformedData;
    },
    transformOutput(data, model, select = []) {
      if (!data) return null;
      const transformedData = data.id ? select.length === 0 || select.includes("id") ? {
        id: data.id
      } : {} : {};
      const tableSchema = schema[model].fields;
      for (const key in tableSchema) {
        if (select.length && !select.includes(key)) {
          continue;
        }
        const field = tableSchema[key];
        if (field) {
          transformedData[key] = transformValueFromDB(
            data[field.fieldName || key],
            model,
            key
          );
        }
      }
      return transformedData;
    },
    convertWhereClause(model, w) {
      if (!w)
        return {
          and: null,
          or: null
        };
      const conditions = {
        and: [],
        or: []
      };
      w.forEach((condition) => {
        let {
          field: _field,
          value,
          operator = "=",
          connector = "AND"
        } = condition;
        const field = getField(model, _field);
        value = transformValueToDB(value, model, _field);
        const expr = (eb) => {
          if (operator.toLowerCase() === "in") {
            return eb(field, "in", Array.isArray(value) ? value : [value]);
          }
          if (operator === "contains") {
            return eb(field, "like", `%${value}%`);
          }
          if (operator === "starts_with") {
            return eb(field, "like", `${value}%`);
          }
          if (operator === "ends_with") {
            return eb(field, "like", `%${value}`);
          }
          if (operator === "eq") {
            return eb(field, "=", value);
          }
          if (operator === "ne") {
            return eb(field, "<>", value);
          }
          if (operator === "gt") {
            return eb(field, ">", value);
          }
          if (operator === "gte") {
            return eb(field, ">=", value);
          }
          if (operator === "lt") {
            return eb(field, "<", value);
          }
          if (operator === "lte") {
            return eb(field, "<=", value);
          }
          return eb(field, operator, value);
        };
        if (connector === "OR") {
          conditions.or.push(expr);
        } else {
          conditions.and.push(expr);
        }
      });
      return {
        and: conditions.and.length ? conditions.and : null,
        or: conditions.or.length ? conditions.or : null
      };
    },
    async withReturning(values, builder, model, where) {
      let res;
      if (config?.type === "mysql") {
        await builder.execute();
        const field = values.id ? "id" : where[0].field ? where[0].field : "id";
        const value = values[field] || where[0].value;
        res = await db.selectFrom(getModelName(model)).selectAll().where(getField(model, field), "=", value).executeTakeFirst();
        return res;
      }
      if (config?.type === "mssql") {
        res = await builder.outputAll("inserted").executeTakeFirst();
        return res;
      }
      res = await builder.returningAll().executeTakeFirst();
      return res;
    },
    getModelName,
    getField
  };
};
const kyselyAdapter = (db, config) => (opts) => {
  const {
    transformInput,
    withReturning,
    transformOutput,
    convertWhereClause,
    getModelName,
    getField
  } = createTransform(db, opts, config);
  return {
    id: "kysely",
    async create(data) {
      const { model, data: values, select } = data;
      const transformed = transformInput(values, model, "create");
      const builder = db.insertInto(getModelName(model)).values(transformed);
      return transformOutput(
        await withReturning(transformed, builder, model, []),
        model,
        select
      );
    },
    async findOne(data) {
      const { model, where, select } = data;
      const { and, or } = convertWhereClause(model, where);
      let query = db.selectFrom(getModelName(model)).selectAll();
      if (and) {
        query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
      }
      if (or) {
        query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
      }
      const res = await query.executeTakeFirst();
      if (!res) return null;
      return transformOutput(res, model, select);
    },
    async findMany(data) {
      const { model, where, limit, offset, sortBy } = data;
      const { and, or } = convertWhereClause(model, where);
      let query = db.selectFrom(getModelName(model));
      if (and) {
        query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
      }
      if (or) {
        query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
      }
      if (config?.type === "mssql") {
        if (!offset) {
          query = query.top(limit || 100);
        }
      } else {
        query = query.limit(limit || 100);
      }
      if (sortBy) {
        query = query.orderBy(
          getField(model, sortBy.field),
          sortBy.direction
        );
      }
      if (offset) {
        if (config?.type === "mssql") {
          if (!sortBy) {
            query = query.orderBy(getField(model, "id"));
          }
          query = query.offset(offset).fetch(limit || 100);
        } else {
          query = query.offset(offset);
        }
      }
      const res = await query.selectAll().execute();
      if (!res) return [];
      return res.map((r) => transformOutput(r, model));
    },
    async update(data) {
      const { model, where, update: values } = data;
      const { and, or } = convertWhereClause(model, where);
      const transformedData = transformInput(values, model, "update");
      let query = db.updateTable(getModelName(model)).set(transformedData);
      if (and) {
        query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
      }
      if (or) {
        query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
      }
      const res = await transformOutput(
        await withReturning(transformedData, query, model, where),
        model
      );
      return res;
    },
    async updateMany(data) {
      const { model, where, update: values } = data;
      const { and, or } = convertWhereClause(model, where);
      const transformedData = transformInput(values, model, "update");
      let query = db.updateTable(getModelName(model)).set(transformedData);
      if (and) {
        query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
      }
      if (or) {
        query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
      }
      const res = await query.execute();
      return res.length;
    },
    async count(data) {
      const { model, where } = data;
      const { and, or } = convertWhereClause(model, where);
      let query = db.selectFrom(getModelName(model)).select(db.fn.count("id").as("count"));
      if (and) {
        query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
      }
      if (or) {
        query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
      }
      const res = await query.execute();
      return res[0].count;
    },
    async delete(data) {
      const { model, where } = data;
      const { and, or } = convertWhereClause(model, where);
      let query = db.deleteFrom(getModelName(model));
      if (and) {
        query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
      }
      if (or) {
        query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
      }
      await query.execute();
    },
    async deleteMany(data) {
      const { model, where } = data;
      const { and, or } = convertWhereClause(model, where);
      let query = db.deleteFrom(getModelName(model));
      if (and) {
        query = query.where((eb) => eb.and(and.map((expr) => expr(eb))));
      }
      if (or) {
        query = query.where((eb) => eb.or(or.map((expr) => expr(eb))));
      }
      return (await query.execute()).length;
    },
    options: config
  };
};

exports.createKyselyAdapter = createKyselyAdapter;
exports.kyselyAdapter = kyselyAdapter;
