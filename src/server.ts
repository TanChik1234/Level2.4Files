import express, { Request, Response, request } from 'express';
import session, { Session } from 'express-session';
const FileStore = require('session-file-store')(session);
import cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import 'abort-controller/polyfill';
import { promises as fsPromises } from 'fs';



//добавляем до сессии свойство user
declare module 'express-session' {
  interface SessionData {
    user?: { login: string };
  }
}

const app = express();
const port = 3005;
const sessionDirectory = "./sessions";
const dataBaseName = "./DataFiles/dataBase.json";


if (!fs.existsSync(sessionDirectory)) {
  fs.mkdirSync(sessionDirectory);
}

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false}));
app.use(bodyParser.json());
app.use(cors({ 
  credentials: true, 
  origin: `http://localhost:${port}` 
}));

app.use(express.static('public'));

app.use(
  express.static(path.join(__dirname, 'public'), {
    index: false,
  })
)

app.use(
  session({
    store: new FileStore({
      path: sessionDirectory,
      ttl: 86400
    }),
    secret: "secret mikky mouse",
    resave: true,
    saveUninitialized: true,
    cookie: {},
  })
);

app.listen(port, () => {
  console.log(`Frontend server is running at http://localhost:${port}`);
});

app.post('/api/v2/router', (req: Request, res: Response) => {
  const action = req.query.action as string;

  switch (action) {
    case 'login':
      console.log("login");
      loginHandler(req, res);
      break;
    case 'logout':
      console.log("logout");
      logoutHandler(req, res);
      break;
    case 'register':
      console.log("register");
      registerHandler(req, res);
      break;
    case 'getItems':
      console.log("getItem");
      getItemsHandler(req, res);
      break;
    case 'deleteItem':
      console.log("deleteItem");
      deleteItemHandler(req, res);
      break;
    case 'createItem':
      console.log("addItem");
      addItemHandler(req, res);
      break;
    case 'editItem':
      console.log("editItem");
      editItemHandler(req, res);
      break;
    default:
      res.status(400).send('Invalid action');
  }
})

async function getItemsHandler(req:Request, res: Response) {
  try {
    const data = await fsPromises.readFile(dataBaseName, 'utf8');
    let parseJsonData = JSON.parse(data);

    let userLogin = req.session.user;

    if(userLogin && parseJsonData[userLogin.toString()]){
      let userData = parseJsonData[userLogin.toString()];
      let useritems = userData.items;
      res.send (JSON.stringify({
        items: useritems
      }));
    } else {
      res.status(500).json({ error: 'Data for this user is absent in the database.' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
}

async function addItemHandler(req: Request, res: Response){
  if (!checkText(req.body.text)) {
    res.status(400).json({ ok: false, error: "Bad Request" });
    return;
  }

  try {
    const data = await fsPromises.readFile(dataBaseName, 'utf8');
    let parseJsonData = JSON.parse(data);

    let userLogin = req.session.user;
    if(!(userLogin && parseJsonData[userLogin.toString()])){
      res.status(500).json({ error: 'Data for this user is absent in the database.' });
      return;
    } 

    const currentID = await findItemID();
    let newItem = {
      id: currentID,
      text: req.body.text,
      checked: false
    }
    parseJsonData[userLogin.toString()].items.push(newItem);

    await fsPromises.writeFile(dataBaseName, JSON.stringify(parseJsonData), 'utf8');
    res.send(JSON.stringify({ id: currentID }));
    console.log("send ok");
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
}

async function editItemHandler(req:Request, res: Response){
  if (!checkText(req.body.text)) {
    res.status(400).json({ ok: false, error: "Bad Request" });
    return;
  }

  try {
    const data = await fsPromises.readFile(dataBaseName, 'utf8');
    let parseJsonData = JSON.parse(data);

    let userLogin = req.session.user;
    if(!(userLogin && parseJsonData[userLogin.toString()])){
      res.status(500).json({ error: 'Data for this user is absent in the database.' });
      return;
    } 

    let userItems = parseJsonData[userLogin.toString()].items;
    for(let i = 0; i < userItems.length; i++){
      if(userItems[i].id === req.body.id) {
        userItems[i].checked = req.body.checked;
        userItems[i].text = req.body.text;
        break;
      }
    };
    parseJsonData[userLogin.toString()].items = userItems;

    await fsPromises.writeFile(dataBaseName, JSON.stringify(parseJsonData), 'utf8');
    res.send(JSON.stringify({ ok: true }));
    console.log("send ok");
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
}

async function deleteItemHandler(req:Request, res: Response){
  try {
    const data = await fsPromises.readFile(dataBaseName, 'utf8');
    let parseJsonData = JSON.parse(data);

    let userLogin = req.session.user;
    if(!(userLogin && parseJsonData[userLogin.toString()])){
      res.status(500).json({ error: 'Data for this user is absent in the database.' });
      return;
    } 

    let userItems = parseJsonData[userLogin.toString()].items;
    for(let i = 0; i < userItems.length; i++) {
      if(userItems[i].id === req.body.id) {
        userItems.splice(i, 1);
        break;
      }
    }
    parseJsonData[userLogin.toString()].items = userItems;

    await fsPromises.writeFile(dataBaseName, JSON.stringify(parseJsonData), 'utf8');
    res.send(JSON.stringify({ ok: true }));
    console.log("send ok");
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
}

async function loginHandler(req:Request, res:Response) {
  const inputData = req.body;
  req.session.user = inputData.login;
  if(checkLoginAndPass(inputData.login, inputData.pass)){
    console.log("wrong data");
    res.status(400).send(JSON.stringify({
      ok: false,
      error: "The login or password is entered incorrectly. The password can only contain Latin letters and numbers"
    }));
    return;
  }

  try {
    const data = await fsPromises.readFile(dataBaseName, 'utf8');
    let parseJsonData = JSON.parse(data);

    let userLogin = req.body.login;
    if(!parseJsonData[userLogin] || (parseJsonData[userLogin].password !== req.body.pass)){
      res.status(400).json({ ok: false, error: 'not found' });
      return;
    } 
    res.send(JSON.stringify({ ok: true }))
    
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
  
}

function logoutHandler (req: Request, res: Response) {
  req.session.destroy((err) => {
    if(err) {
      res.status(500).json({
        ok: false,
        error: "Error logging out"
      });
    } else {
      res.json({ ok: true });
    }
  })
};


async function registerHandler(req:Request, res:Response){
  const inputData = req.body;
  console.log(req.body.login +"  "+req.body.pass);
  if(checkLoginAndPass(inputData.login, inputData.pass)){
    console.log("wrong data");
    res.status(400).send(JSON.stringify({
      ok: false,
      error: "The login or password is entered incorrectly. The password can only contain Latin letters and numbers"
    }));
    return;
  }

  try {
    const data = await fsPromises.readFile(dataBaseName, 'utf8');
    let parseJsonData = JSON.parse(data);

    if(parseJsonData[req.body.user]){
      res.status(500).json({ ok: false, error: 'The given login is already taken.' });
      return;
    } 

    let userData = {
      password: req.body.pass,
      items: []
    }

    parseJsonData[req.body.login]= userData;
    await fsPromises.writeFile(dataBaseName, JSON.stringify(parseJsonData), 'utf8');
    res.send(JSON.stringify({ ok: true }))
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }
}

function checkLoginAndPass(login: string, pass: string): boolean {
  const regexpLogin = /^[\w|\d][-a-z\d.+]{1,19}@[-_?=/+*'&%$!.\w\d]{1,15}\.\w{1,5}$/i;
  const regexpPass = /^[a-z\d]{6,}$/i;

  return !(regexpLogin.test(login) && regexpPass.test(pass));
}

function checkText(text: string): boolean {
  let regexp = /[<>/&#]]/g;
  return !regexp.test(text);
}

async function findItemID(): Promise<number> {
  const filePath = "./DataFiles/counterTodo.txt";

  try {
    const data: string = await fsPromises.readFile(filePath, 'utf8');
    let idItem: number = +data + 1;

    await fsPromises.writeFile(filePath, idItem.toString(), 'utf8');
    return idItem;
  } catch (error) {
    console.error('Ошибка:', error);
    throw error; 
  }
}