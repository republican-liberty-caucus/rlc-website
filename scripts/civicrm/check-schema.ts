import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env.civicrm') });

const config = {
  host: process.env.CIVICRM_DB_HOST!,
  port: parseInt(process.env.CIVICRM_DB_PORT || '3306', 10),
  user: process.env.CIVICRM_DB_USER!,
  password: process.env.CIVICRM_DB_PASSWORD!,
  database: process.env.CIVICRM_DB_NAME!,
};

async function main() {
  const connection = await mysql.createConnection(config);

  console.log('\n=== Membership Table Columns ===');
  const [membershipCols] = await connection.execute('DESCRIBE civicrm_membership');
  console.log(membershipCols);

  console.log('\n=== Contribution Status Check ===');
  const [tables] = await connection.execute("SHOW TABLES LIKE 'civicrm_contribution%'");
  console.log(tables);

  console.log('\n=== Group Table Columns ===');
  const [groupCols] = await connection.execute('DESCRIBE civicrm_group');
  console.log(groupCols);

  await connection.end();
}

main().catch(console.error);
