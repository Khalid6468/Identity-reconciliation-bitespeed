// Assumption:
// Doc wont shop with same pair of (email, phoneNumber) details


const express = require("express");
const mysql = require('mysql2');
const app = express();
const port = 8081;

app.use(express.json())

function JsDateToMySQLDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
  
    return `${year}-${month}-${day}`;
}

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Khalid@6468",
    database: "bitespeed",
});

db.connect(function(err) {
    if(err)
        return console.error('error: ' + err.message);
    console.log("connected to db");
});

const q = `create table if not exists Contacts (
    id int primary key auto_increment,
    phoneNumber varchar(10),
    email varchar(255),
    linkedId int,
    linkPrecedence enum('primary', 'secondary') not null,
    createdAt datetime not null,
    updatedAt datetime not null,
    deletedAt datetime
)`;

db.query(q, (err, _) => {
    if(err) {
        console.error("Error creating Contacts table: ", err);
    } else {
        console.log('Contacts table created successfully');
    }
});


const initHandler = async (req, res, next) => {
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;
    if(email === null || phoneNumber === null)
        next();
    else {
        try {
            const emailResults = await new Promise((resolve, rej) => {
                db.query(`select * from Contacts where email = "${email}"`, (err, results) => {
                    if(err)
                        rej(err);
                    else
                        resolve(results);
                });
            });

            const emailExists = emailResults.length > 0;
            const phoneNumberResults = await new Promise((resolve, rej) => {
                db.query(`select * from Contacts where phoneNumber = "${phoneNumber}"`, (err, results) => {
                    if(err)
                        rej(err);
                    else
                        resolve(results);
                });
            });
            const phoneNumberExists = phoneNumberResults.length > 0;
            if(!emailExists || !phoneNumberExists) {
                console.log("One of them is not seen");
                next();
            }
            else {
                console.log("Some row already has the same set of values");
                const createdAt = JsDateToMySQLDate(new Date());
                const updatedAt = createdAt;
                console.log("first")
                await new Promise((resolve, rej) => {
                    db.query(`insert into Contacts (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt) 
                                values ("${phoneNumber}", "${email}", null, 'primary', "${createdAt}", "${updatedAt}", null)
                `, function(err, _) {
                        if(err) {
                            console.log("insertion of new User failed", err);
                            rej(err);
                        }else {
                            console.log("User inserted and is primary now.");
                            resolve();
                        }
                    });
                });
                console.log("second")
                const id = await new Promise((resolve, rej) => {
                    db.query(`select id from Contacts where phoneNumber = "${phoneNumber}" and email = "${email}"`, function(err, results) {
                        if(err) {
                            rej(err);
                        }else {
                            resolve(results[0].id);
                        }
                    });
                });
                await new Promise((resolve, rej) => {
                    db.query(`update Contacts set linkPrecedence = 'secondary', linkedId = ${id} where ((phoneNumber = "${phoneNumber}" and email != "${email}") or (email = "${email}" and phoneNumber != "${phoneNumber}"))`,
                        (err, _) => {
                            if(err){
                                console.log("fugg");
                                rej(err);
                            }
                            else
                                resolve();
                        }
                    );
                });
                finalProcessing(req, res);
            }
        } catch (err) {
            next(err);
        }
    }
};

const firstMiddleWare = async(req, res, next) => {
    let email = req.body.email;
    let phoneNumber = req.body.phoneNumber;
    if(email === null) {
        // console.log("EMAIL IS NULL");
        email = await new Promise((res, rej) => {
            db.query(`select email from Contacts where phoneNumber="${phoneNumber}"`, (err, results) => {
                if(err)
                    rej(err);
                else
                    res(results[0].email);
            });
        });
        req.body.email = email;
        finalProcessing(req, res);
    } else if(phoneNumber === null) {
        phoneNumber = await new Promise((res, rej) => {
            db.query(`select phoneNumber from Contacts where email="${email}"`, (err, results)=>{
                if(err)
                    rej(err)
                else
                    res(results[0].phoneNumber);
            });
        });
        req.body.phoneNumber = phoneNumber;
        finalProcessing(req, res);
    }
    else {
        try{
            const results = await new Promise((res, rej) => {
                db.query(`SELECT * FROM Contacts where email = "${email}" or phoneNumber = "${phoneNumber}"`, (err, results) => {
                    if(err) {
                        console.error("Error getting entries with email/phoneNumber given");
                        rej(err);
                    } else {
                        res(results);
                    }
                });
            });
            let linkedId;
            let linkPrecedence;
            let createdAt = JsDateToMySQLDate(new Date());
            let updatedAt = JsDateToMySQLDate(new Date());
            if(results.length == 0) {
                linkedId = null;
                linkPrecedence = "primary";
            } else {
                linkedId = results[0].id;
                linkPrecedence = "secondary";
            }
            await new Promise((res, rej) => {
                db.query(`insert into Contacts (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt) 
                            values ("${phoneNumber}", "${email}", ${linkedId}, '${linkPrecedence}', "${createdAt}", "${updatedAt}", null)
            `, function(err, _) {
                    if(err) {
                        console.log("insertion of new User failed", err);
                        rej(err);
                    }else {
                        res();
                    }
                });
            });
            
            next();
        } catch (err) {
            next(err);
        }
    }
};

const finalProcessing = async (req, res) => {
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;

    const results = await new Promise((res, rej) => {
        db.query(`select id, email, phoneNumber from Contacts where (email = "${email}" or phoneNumber = "${phoneNumber}") and linkPrecedence = 'primary'`, (err, results) => {
                    if(err) {
                        console.error(err);
                        rej(err);
                    } else {
                        res(results);
                    }
                });
    });
    const primaryId = results[0].id;
    const primaryEmail = results[0].email;
    const primaryPhoneNumber = results[0].phoneNumber;
    

    const secondaryIds = [];
    const secondaryEmails = [];
    const secondaryPhoneNumbers = [];
    const emails = [];
    const phoneNumbers = [];

    const secondaryResults = await new Promise((res, rej) => {
        db.query(`select id, email, phoneNumber from Contacts where (email = "${email}" or phoneNumber = "${phoneNumber}") and linkPrecedence = 'secondary'`,
        (err, results) => {
            if(err) {
                console.log(err);
                rej(err);
            } else {
                res(results);
            }
        });
    });
                                
    for(let i=0;i<secondaryResults.length;i++) {
        secondaryIds.push(secondaryResults[i].id);
        if(!secondaryEmails.includes(secondaryResults[i].emails))
            secondaryEmails.push(secondaryResults[i].email);
        if(!secondaryPhoneNumbers.includes(secondaryResults[i].phoneNumber))
            secondaryPhoneNumbers.push(secondaryResults[i].phoneNumber);
    }
    
    emails.push(primaryEmail);
    phoneNumbers.push(primaryPhoneNumber);
    for(let i=0;i<secondaryEmails.length;i++) {
        if(secondaryEmails[i] !== primaryEmail) {
            emails.push(secondaryEmails[i]);
        }
    }
    for(let i=0;i<secondaryPhoneNumbers.length;i++) {
        if(secondaryPhoneNumbers[i] !== primaryPhoneNumber) {
            emails.push(secondaryPhoneNumbers[i]);
        }
    }
    
    const resp = {
        "contact": {
            "primaryContactId": primaryId,
            "emails": emails,
            "phoneNumbers": phoneNumbers,
            "secondaryContactIds": secondaryIds
        }
    };
    res.json(resp);
};

app.post('/identify', initHandler, firstMiddleWare, finalProcessing);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
