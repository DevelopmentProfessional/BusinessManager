const pgp = require('pg-promise')();

// Connection to Render Database
const renderDbUrl = process.env.RENDER_DATABASE_URL;

// Connection to EC2 Database
const ec2DbUrl = process.env.EC2_DATABASE_URL;

if (!renderDbUrl || !ec2DbUrl) {
    throw new Error('RENDER_DATABASE_URL and EC2_DATABASE_URL must be configured.');
}

const renderDb = pgp(renderDbUrl);
const ec2Db = pgp(ec2DbUrl);

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
