const axios = require('axios');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: '',
    password: ''
});

// Create the us_congress database and tables
async function createDatabase() {
    const connection = await pool.getConnection();
  
    try {
      // Create the us_congress database
      await connection.query('CREATE DATABASE IF NOT EXISTS us_congress');
  
      // Use the us_congress database
      await connection.query('USE us_congress');
  
      // Create the house_members table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS house_members (
          id INT NOT NULL AUTO_INCREMENT,
          member_id VARCHAR(255) NOT NULL,
          first_name VARCHAR(255) NOT NULL,
          last_name VARCHAR(255) NOT NULL,
          portrait_url VARCHAR(255) NOT NULL,
          portrait_data LONGBLOB NOT NULL,
          gender ENUM('M', 'F') NOT NULL,
          party VARCHAR(255) NOT NULL,
          district VARCHAR(255),
          state VARCHAR(255) NOT NULL,
          assumed_year INT NOT NULL,
          birth_date DATE NOT NULL,
          office VARCHAR(255),
          phone VARCHAR(255),
          committee_titles TEXT NOT NULL,
          PRIMARY KEY (id)
        )
      `);
      // Create the senate_members table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS senate_members (
          id INT NOT NULL AUTO_INCREMENT,
          member_id VARCHAR(255) NOT NULL,
          first_name VARCHAR(255) NOT NULL,
          last_name VARCHAR(255) NOT NULL,
          portrait_url VARCHAR(255) NOT NULL,
          portrait_data LONGBLOB NOT NULL,
          gender ENUM('M', 'F') NOT NULL,
          party VARCHAR(255) NOT NULL,
          state VARCHAR(255) NOT NULL,
          assumed_year INT NOT NULL,
          birth_date DATE NOT NULL,
          office VARCHAR(255),
          phone VARCHAR(255),
          committee_titles TEXT NOT NULL,
          PRIMARY KEY (id)
        )
      `);
  
      console.log('Database created successfully');
    } finally {
      connection.release();
    }
  }
  
// Run the script
createDatabase();

const apiKey = '';

async function fetchHouseMembers() {
    const response = await axios.get('https://api.propublica.org/congress/v1/117/house/members', {
        headers: {
        'X-API-Key': apiKey
        }
    });
    
    return response.data.results[0].members;

}

async function fetchSenateMembers() {
    const response = await axios.get('https://api.propublica.org/congress/v1/117/senate/members', {
        headers: {
        'X-API-Key': apiKey
        }
    });
    
    return response.data.results[0].members;
}

async function getHouseCommitteeTitles(memberId) {
    const response = await axios.get(`https://api.propublica.org/congress/v1/members/${memberId}.json`, {
      headers: {
        'X-API-Key': apiKey
      }
    });
    const roles = response.data.results[0].roles.filter(role => role.congress === '117' && role.chamber === 'House');
    let committees = [];
    roles[0].committees.map(committee => committees.push(committee.name));
    roles[0].subcommittees.map(subcommittee => subcommittees.push(subcommittee.name));

    return JSON.stringify(committees);
  }

async function getSenateCommitteeTitles(memberId) {
    const response = await axios.get(`https://api.propublica.org/congress/v1/members/${memberId}.json`, {
      headers: {
        'X-API-Key': apiKey
      }
    });
    const roles = response.data.results[0].roles.filter(role => role.congress === '117' && role.chamber === 'Senate');
    let committees = [];
    roles[0].committees.map(committee => committees.push(committee.name));

    return committees;
  }

async function saveHouseMembers(members) {
    const connection = await pool.getConnection();
  
    try {
      for (const member of members) {
        // Extract the relevant data for each member
        const member_id = member.id;
        const first_name = member.first_name;
        const last_name = member.last_name;
        const portrait_url = `https://theunitedstates.io/images/congress/225x275/${member_id}.jpg`;
        const portrait_data = await axios.get(portrait_url, { responseType: 'arraybuffer' }).then(response => response.data).catch(err => false);
        const party = member.party;
        const district = member.district;
        const state = member.state;
        const gender = member.gender;
        const birthDate = member.date_of_birth;
        const office = member.office || null;
        const phone = member.phone || null;
        const currentYear = new Date().getFullYear();
        const assumedYear = currentYear - member.seniority;
        const committeeTitles = await getHouseCommitteeTitles(member_id);
        // Insert the member data into the database
        await connection.execute('INSERT INTO house_members (member_id, first_name, last_name, portrait_url, portrait_data, gender, party, district, state, assumed_year, birth_date, office, phone, committee_titles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [member_id, first_name, last_name, portrait_url, portrait_data, gender, party, district, state, assumedYear, birthDate, office, phone, committeeTitles]);
      }
    } finally {
      connection.release();
    }
  }

async function saveSenateMembers(members) {
    const connection = await pool.getConnection();
  
    try {
      for (const member of members) {
        // Extract the relevant data for each member
        const member_id = member.id;
        const first_name = member.first_name;
        const last_name = member.last_name;
        const portrait_url = `https://theunitedstates.io/images/congress/225x275/${member_id}.jpg`;
        const portrait_data = await axios.get(portrait_url, { responseType: 'arraybuffer' }).then(response => response.data).catch(err => false);
        const party = member.party;
        const state = member.state;
        const gender = member.gender;
        const birthDate = member.date_of_birth;
        const office = member.office || null;
        const phone = member.phone || null;
        const currentYear = new Date().getFullYear();
        const assumedYear = currentYear - member.seniority;
        const committeeTitles = await getSenateCommitteeTitles(member_id);
        // Insert the member data into the database
        await connection.execute('INSERT INTO senate_members (member_id, first_name, last_name, portrait_url, portrait_data, gender, party, state, assumed_year, birth_date, office, phone, committee_titles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [member_id, first_name, last_name, portrait_url, portrait_data, gender, party, state, assumedYear, birthDate, office, phone, committeeTitles]);
      }
    } finally {
      connection.release();
    }
  }

(async () => {
    const houseMembers = await fetchHouseMembers();
    const senateMembers = await fetchSenateMembers();

    await saveHouseMembers(houseMembers);
    await saveSenateMembers(senateMembers);

    console.log('Done!');
})();