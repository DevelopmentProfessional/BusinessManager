const pgp = require('pg-promise')();

// Connection to Render Database
const renderDb = pgp('postgresql://lavish_beauty_db_user:1haMVuAaGaJN3kWTKJrRNY211mSAAnw3@dpg-d2qsadmr433s73eqpd40-a.oregon-postgres.render.com/lavish_beauty_db');

// Connection to EC2 Database
const ec2Db = pgp('postgresql://postgres:database-1-instance-1@localhost:5432/postgres?sslmode=disable');

async function migrateData() {
    try {
        const data = await renderDb.any('SELECT * FROM your_table'); // Replace 'your_table' with the actual table name

        // Insert data into EC2 database
        for (const row of data) {
            await ec2Db.none('INSERT INTO your_table(column1, column2) VALUES(${column1}, ${column2})', row); // Adjust columns as necessary
        }

        console.log('Data migration completed successfully!');
    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        pgp.end();
    }
}

migrateData();
