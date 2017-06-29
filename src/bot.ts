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

import { IRule, first, best, prependMatcher, rule, run } from 'prague-botframework-browserbot';

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
            dialogStack: (match as any).dialogStack || []
        }),
        matchRemoteToLocal: (match, tasks) => ({
            activity: match.activity,
            text: match.text,
            message: match.message,
            address: match.address,
            data: match.data,
            dialogStack: match.dialogStack || [],
            reply: (message: any) => tasks.push({
                method: 'reply',
                args: {
                    message
                }
            })
        } as any),
        executeTasks: (match, tasks) => {
            tasks.forEach(task => {
                switch (task.method) {
                    case 'reply':
                        match.reply(task.args.message);
                        break;
                    default:
                        console.warn(`Remote dialog added task "${task.method}" but no such task exists.`)
                        break;
                }
            })
        },
    }
);

// Prompts/Dialogs

const commentPrompt = dialogs.addLocal(
    match => match.reply("Which comment would you like to see (0-99)?"),
    match => fetch(`https://jsonplaceholder.typicode.com/comments/${match.text}`)
        .then(response => response.json())
        .then(json => {
            match.reply(json.name);
            return match.replaceThisDialog(anotherPrompt);
        })
    ,
    'Comment',
)
const anotherPrompt = dialogs.addLocal(
    match => match.reply("Would you like to see another?"),
    first(
        rule(
            m => m.text === 'yes',
            match => match.replaceThisDialog(commentPrompt)
        ),
        match => {
            match.reply("See you later, alligator.");
            return match.endThisDialog();
        }
    ),
    'Another',
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

const gameDialog = dialogs.addRemote<GameArgs, GameResponse>(
    'http://localhost:9000/dialogs',
    'game'
);

const appRule: IRule<B & IDialogRootMatch> = first(


    dialogs.runChildIfActive(),
    re(/show comment/, m => m.beginChildDialog(commentPrompt)),
    re(/help/, m => m.reply("there is no help for you")),
    re(/game/, m => m.beginChildDialog(gameDialog, { upperLimit: 50, maxGuesses: 10 })),
    re(/I am (.*)/,
        first(
            rule(
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

