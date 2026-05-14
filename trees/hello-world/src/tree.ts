import {
	action,
	ambient,
	delegate,
	evaluate,
	global,
	instruct,
	local,
	selector,
	sequence,
} from "@abtree/dsl";

// Module-scope state declarations: clean, unmangled keys land in
// `ambient`, the build script tacks them onto the emitted tree-file as
// the root-level `state`.
const timeOfDay = local("time_of_day", null);
const greeting = local("greeting", null);
const userName = global(
	"user_name",
	'retrieve by running the shell command "whoami"',
);
const tone = global("tone", "friendly");
const language = global("language", "english");

export const tree = sequence("Hello_World", () => {
	action("Determine_Time", () => {
		instruct(`
			Check the system clock to get the current hour. Classify as:
			before 12:00 = "morning", 12:00-17:00 = "afternoon", after 17:00 = "evening".
			Store the classification string at ${timeOfDay}.
		`);
	});

	delegate(
		"Compose_Greeting",
		{
			brief: `
				Pick the time-of-day branch matching ${timeOfDay} and compose
				a single short greeting sentence addressing ${userName} in
				${language} with a ${tone} tone. Write the sentence to
				${greeting}.
			`,
			model: "haiku",
			output: greeting,
		},
		() => {
			selector("Choose_Greeting", () => {
				action("Morning_Greeting", () => {
					evaluate(`${timeOfDay} is "morning"`);
					instruct(
						`Compose a cheerful morning greeting addressing ${userName} in ${language} with a ${tone} tone. Store at ${greeting}.`,
					);
				});
				action("Afternoon_Greeting", () => {
					evaluate(`${timeOfDay} is "afternoon"`);
					instruct(
						`Compose a warm afternoon greeting addressing ${userName} in ${language} with a ${tone} tone. Store at ${greeting}.`,
					);
				});
				action("Evening_Greeting", () => {
					evaluate(`${timeOfDay} is "evening"`);
					instruct(
						`Compose a relaxed evening greeting addressing ${userName} in ${language} with a ${tone} tone. Store at ${greeting}.`,
					);
				});
			});
		},
	);

	action("Announce_Greeting", () => {
		instruct(`
			Read ${greeting} via \`abtree local read\` and print it verbatim
			to the human. This step runs in the parent agent after the
			delegated subagent has returned.
		`);
	});
});

export { ambient };
