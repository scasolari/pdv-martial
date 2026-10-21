import { DiMysql, DiPostgresql } from "react-icons/di";
import { DiMsqlServer, DiSqllite } from "react-icons/di";
import { SiMariadb } from "react-icons/si";
import { FiDatabase } from "react-icons/fi";

export default function DatabaseEngineIcon({ dialect, size = 14, className = "" }) {
    if (dialect === "postgres") {
        return <DiPostgresql size={size + 2} className={`shrink-0 text-[#336791] ${className}`} aria-label="PostgreSQL" />;
    }
    if (dialect === "mysql") {
        return <DiMysql size={size + 2} className={`shrink-0 text-[#00758F] ${className}`} aria-label="MySQL" />;
    }
    if (dialect === "mariadb") {
        return <SiMariadb size={size} className={`shrink-0 text-[#003545] dark:text-[#C6D2D8] ${className}`} aria-label="MariaDB" />;
    }
    if (dialect === "sqlite") {
        return <DiSqllite size={size + 2} className={`shrink-0 text-[#003B57] dark:text-[#7DC6F5] ${className}`} aria-label="SQLite" />;
    }
    if (dialect === "mssql") {
        return <DiMsqlServer size={size + 2} className={`shrink-0 text-[#CC2927] ${className}`} aria-label="Microsoft SQL Server" />;
    }
    return <FiDatabase size={size} className={`shrink-0 ${className}`} aria-label="Database" />;
}
