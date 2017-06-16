import { IStateMatch, ChatState } from 'prague-botframework-browserbot';

// It's overkill for BrowserBot use ChatState, but it opens the door to reusing all/most of the code
// in a Bot Framework Connected web service where all other fields would be relevant.

// Add state to your bot here:

interface UserInConversationState {
    vip?: boolean;
    rootDialogInstance?: DialogInstance;
    promptKey?: string;
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

import { IRule, first, rule, run } from 'prague-botframework-browserbot';

// Regular Expressions

import { matchRegExp, re, IRegExpMatch } from 'prague-botframework-browserbot';

// LUIS

import { LuisModel } from 'prague-botframework-browserbot';

// WARNING: don't check your LUIS id/key in to your repo!

const luis = new LuisModel('id', 'key');

// Prompts

import { PromptRules, TextPrompts, createChoice, createConfirm } from 'prague-botframework-browserbot';

const promptRules: PromptRules<B> = {
    'Comment': rule<B>(
            match => fetch(`https://jsonplaceholder.typicode.com/comments/${match.text}`)
                .then(response => response.json())
                .then(json => match.reply(json.name))
        )
}

const prompts = new TextPrompts<B>(
    promptRules,
    (match) => match.data.userInConversation.promptKey,
    (match, promptKey) => {
        match.data.userInConversation.promptKey = promptKey
    }
);

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
        newInstance: (name: string, dialogData: any = {}) => {
            if (!dialogDataStorage[name])
                dialogDataStorage[name] = [];
            return (dialogDataStorage[name].push(dialogData) - 1).toString();
        },
        getDialogData: (dialogInstance: DialogInstance) => ({ ...
            dialogDataStorage[dialogInstance.name][dialogInstance.instance]
        }),
        setDialogData: (dialogInstance: DialogInstance, dialogData?: any) => {
            dialogDataStorage[dialogInstance.name][dialogInstance.instance] = dialogData;
        }
    }
);

dialogs.addLocal('stock', first(
    re(/msft/, m => m.reply("MSFT is up to 95!")),
    re(/aapl/, m => m.reply("AAPL is down to 10!"))
));

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

dialogs.addLocal<GameArgs, GameResponse, GameState>('game',
    first(
        dialogs.runChildIfActive(),
        re(/stock/, m => m.beginChildDialog('stock')),
        re(/clear/, m => m.clearChildDialog()),
        re(/replace/, m => m.replaceThisDialog('stock', undefined, { result: "replaced" })),
        re(/help/, m => m.reply("special game help")),
        rule(matchRegExp(/\d+/), m => {
            const guess = m.groups[0];
            if (guess === m.dialogData.num) {
                m.reply("You're right!");
                return m.endThisDialog({ result: "win" });
            }

            if (guess < m.data.userInConversation.num )
                m.reply("That is too low.");
            else
                m.reply("That is too high.");

            if (--m.dialogData.guesses === 0) {
                m.reply("You are out of guesses");
                return m.endThisDialog({ result: "lose" });
            }
            
            m.reply(`You have ${m.dialogData.guesses} left.`);
        })
    ),
    match => {
        match.reply(`Guess a number between 0 and ${match.dialogArgs.upperLimit}. You have ${match.dialogArgs.maxGuesses} guesses.`);
        return {
            num: Math.floor(Math.random() * match.dialogArgs.upperLimit),
            guesses: match.dialogArgs.maxGuesses
        }
    }
);

const introRule: IRule<B & IDialogRootMatch> = rule(
    matchRegExp(/I am (.*)/i),
    first(
        rule(match => match.groups[1] === 'Bill', match => {
            match.reply(`You are very handsome, ${match.groups[1]}`);
            match.data.userInConversation.vip = true;
        }),
        match => {
            match.reply(`Nice to meet you, ${match.groups[1]}`);
            match.data.userInConversation.vip = false;
        }
    )
);

const appRule: IRule<B & IDialogRootMatch> = first(
    // prompts,

    luis.best({
        'singASong': match =>
            match.reply(`Let's sing ${match.entityValues('song')[0]}`),
        'findSomething': match =>
            match.reply(`Okay let's find a ${match.entityValues('what')[0]} in ${match.entityValues('where')[0]}`)
    }),

    dialogs.runChildIfActive('game', match => match.reply(`I hear that the result of your game was ${match.dialogResponse.result}`)),

    re(/prompt me/, match => match.beginChildDialog('prompt', { text: "What do you want to do with your life?" })),

    re(/show comment/, match => {
        match.reply("Which comment would you like to see (0-99)?");
        prompts.setPrompt(match, 'Comment');
    }),

    re(/game/, m => m.beginChildDialog<GameArgs>('game', { upperLimit: 100, maxGuesses: 5 })),

    re(/hi/, m => console.log("HI BILL")),

    introRule,

    re(/Howdy|Hi|Hello|Wassup/i, match => match.reply("Howdy")),

    match => match.reply(`I don't understand you${ match.data.userInConversation.vip ? ", sir" : ""}.`),
);

browserBot.run({
    message: appRule.prependMatcher(match => dialogs.matchRootDialog(match))
});
