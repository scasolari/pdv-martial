export function quoteSqlIdentifier(sequelize, identifier) {
    return sequelize.getQueryInterface().queryGenerator.quoteIdentifier(identifier);
}

export function nullSafeEqualsSql(dialect, left, right) {
    if (dialect === "postgres") return `${left} IS NOT DISTINCT FROM ${right}`;
    if (dialect === "mssql") return `(${left} = ${right} OR (${left} IS NULL AND ${right} IS NULL))`;
    if (dialect === "sqlite") return `${left} IS ${right}`;
    return `${left} <=> ${right}`;
}
