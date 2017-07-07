import { IStateMatch, ChatState } from 'prague-botframework-browserbot';

// It's overkill for BrowserBot use ChatState, but it opens the door to reusing all/most of the code
// in a Bot Framework Connected web service where all other fields would be relevant.

// Add state to your bot here:

interface UserInConversationState {
    rootDialogInstance?: DialogInstance;
}

type BotData = ChatState<undefined, undefined, undefined, undefined, UserInConversationState>;

const botData: BotData = {
    bot: undefined,
    channel: undefined,
    userInChannel: undefined,
    conversation: undefined,
    userInConversation: {
    }
}

import { UniversalChat, WebChatConnector, BrowserBot, IChatMessageMatch } from 'prague-botframework-browserbot';

const webChat = new WebChatConnector()
window["browserBot"] = webChat.botConnection;
const browserBot = new BrowserBot<BotData>(new UniversalChat(webChat.chatConnector), botData);

// This is our "base message type" which is used often enough that we made it really short

type B = IStateMatch<BotData> & IChatMessageMatch;

// General purpose rule stuff

import { IRouter, first, best, prependMatcher, router, run } from 'prague-botframework-browserbot';

// Regular Expressions

import { matchRegExp, re, IRegExpMatch } from 'prague-botframework-browserbot';

// LUIS

import { LuisModel } from 'prague-botframework-browserbot';

// WARNING: don't check your LUIS id/key in to your repo!

const luis = new LuisModel('id', 'key');

// Dialogs

import { RootDialogInstance, DialogInstance, LocalDialogInstances, Dialogs, IDialogRootMatch } from 'prague-botframework-browserbot'

// Here is where we create and store dialog instances and their data. In the real world this would be an external store e.g. Redis

const dialogDataStorage: {
    [name: string]: any[];
} = {};

const dialogs = new Dialogs<B>({
        get: (match) => match.data.userInConversation.rootDialogInstance,
        set: (match, rootDialogInstance) => {
            match.data.userInConversation.rootDialogInstance = rootDialogInstance
        }
    }, {
        newInstance: (name, dialogData: any = {}) => {
            if (!dialogDataStorage[name])
                dialogDataStorage[name] = [];
            return {
                name,
                instance: (dialogDataStorage[name].push(dialogData) - 1).toString()
            };
        },
        deleteInstance: (dialogInstance) => {},
        getDialogData: (dialogInstance) => ({ ...
            dialogDataStorage[dialogInstance.name][dialogInstance.instance]
        }),
        setDialogData: (dialogInstance, dialogData?) => {
            dialogDataStorage[dialogInstance.name][dialogInstance.instance] = dialogData;
        }
    }, {
        matchLocalToRemote: (match: B) => ({
            activity: match.activity,
            text: match.text,
            message: match.message,
            address: match.address,
            data: match.data,
        }),
        matchRemoteToLocal: (match, tasks) => ({
            activity: match.activity,
            text: match.text,
            message: match.message,
            address: match.address,
            data: match.data,
            reply: (message: any) => tasks.push({
                method: 'reply',
                args: {
                    message
                }
            })
        } as any),
        executeTask: (match, task) => {
            switch (task.method) {
                case 'reply':
                    match.reply(task.args.message);
                    break;
                default:
                    console.warn(`Remote dialog added task "${task.method}" but no such task exists.`)
                    break;
            }
        },
    }
);

// Prompts/Dialogs

const commentPrompt = dialogs.add(
    'Comment',
    match => match.reply("Which comment would you like to see (0-99)?"),
    match => fetch(`https://jsonplaceholder.typicode.com/comments/${match.text}`)
        .then(response => response.json())
        .then(json => {
            match.reply(json.name);
            return match.replaceThisDialog(anotherPrompt);
        })
)
const anotherPrompt = dialogs.add(
    'Another',
    match => match.reply("Would you like to see another?"),
    first(
        router(
            m => m.text === 'yes',
            match => match.replaceThisDialog(commentPrompt)
        ),
        match => {
            match.reply("See you later, alligator.");
            return match.endThisDialog();
        }
    )
)

interface GameState {
    num: number,
    guesses: number
}

interface GameArgs {
    upperLimit: number;
    maxGuesses: number;
}

interface GameResponse {
    result: string;
}

const gameDialog = dialogs.add<GameArgs, GameResponse>(
    'game',
    'http://localhost:9000/dialogs',
);

// const gameDialog = dialogs.add<GameArgs, GameResponse, GameState>(
//     'game',
//     m => {
//         console.log("game activate");
//         m.reply(`Guess a number between 0 and ${m.dialogArgs.upperLimit}. You have ${m.dialogArgs.maxGuesses} guesses.`);
//         return {
//             num: Math.floor(Math.random() * m.dialogArgs.upperLimit),
//             guesses: m.dialogArgs.maxGuesses
//         }
//     },
//     first(
//         re(/local/, m => console.log("no remote tasks")),
//         re(/help/, m => m.reply("game help")),
//         re(/cheat/, m => m.reply(`The answer is ${m.dialogData.num}`)),
//         re(/\d+/, m => {
//             const guess = parseInt(m.groups[0]);
//             if (guess === m.dialogData.num) {
//                 m.reply("You're right!");
//                 return m.endThisDialog({ result: "win" });
//             }

//             if (guess < m.dialogData.num )
//                 m.reply("That is too low.");
//             else
//                 m.reply("That is too high.");

//             if (--m.dialogData.guesses === 0) {
//                 m.reply("You are out of guesses");
//                 return m.endThisDialog({ result: "lose" });
//             }
            
//             m.reply(`You have ${m.dialogData.guesses} left.`);
//         }),
//     ),
// );

const appRule: IRouter<B & IDialogRootMatch> = first(

    re(/help/, m => m.reply("there is no help for you")),
    dialogs.runChildIfActive(),
    re(/show comment/, m => m.beginChildDialog(commentPrompt)),
    re(/clear/, m => m.clearChildDialog()),
    re(/game/, m => m.beginChildDialog(gameDialog, { upperLimit: 50, maxGuesses: 10 })),
    re(/I am (.*)/,
        first(
            router(
                m => m.groups[1] === 'Bill',
                m => m.reply(`You are a very special flower, ${m.groups[1]}`)
            ),
            m => m.reply(`Nice to meet you, ${m.groups[1]}`),
        )
    ),
    re(/Hello|Hi|Wassup/i, m => m.reply("Hi there")),
    m => m.reply(`Peace out, dawg`)

);





















browserBot.run({
    message: prependMatcher(match => dialogs.matchRootDialog(match), appRule)
});

