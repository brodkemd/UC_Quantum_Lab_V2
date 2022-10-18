import * as path from 'path';
import * as fs from "fs"
import * as vscode from 'vscode';
import * as cp from "child_process";
import * as util from "util";
import { Config } from './config';
const execProm = util.promisify(cp.exec);

//Create output channel
export let out = vscode.window.createOutputChannel("UC_Q");

// declaring print function (because I am lazy)
export function print(msg:string) { out.appendLine(`- ${msg}`); }

// declaring types for easy of use later
export type infoInnerType = {"path" : string, "exe" : string, "pip" : string, "has_qiskit" : boolean}
export type infoType = {[name:string] : infoInnerType};
export type configType = {[key : string] : string|boolean};

/**
 * trims everything but the last file/directory of a path
 * @param _path : string representation of a path
 * @returns : input path with the all but the file/directory removed
 */
export function get_last_from_path(_path:string) {
    return _path.slice(_path.lastIndexOf(path.sep)+1, _path.length);
}

/**
 * Sends an error message to the user
 * @param msg : error message to send to the user
 */
export function error(msg:string) {
    print(`Error: ${msg}`);
    vscode.window.showErrorMessage(msg);
}

/**
 * delays the execution of the code by the specified milliseconds
 * @param ms : time in milliseconds to delay
 * @returns a promise function that delays the code
 */
export async function delay(ms: number) { return new Promise( resolve => setTimeout(resolve, ms)); }

/**
 * Executes a commands and returns a boolean indicating if it suceeded
 * @param command : string to execute on the system
 * @returns a boolean indicating if the command succeeded
 */
export async function try_command(command:string):Promise<boolean> {
    print(`Trying command "${command}"`);
    let to_return:boolean = false;
    try {
        await execProm(command).then(
            (err) => {
                if (err.stderr.length) {
                    // ignores deprication error
                    if (err.stderr.indexOf("DEPRECATION") === -1) { // accounts for pip package problems
                        to_return = false; 
                        print(`Encountered error "${err.stderr.toString()}"`);
                    } else {
                        print(`ignoring error "${err.stderr.toString()}"`);
                        to_return = true;
                    }
                }
                else { to_return = true; }
                //else { error(`from try command ${err.stderr.toString()}`); }
            }
        );
    } catch ( e ) {
        print(`caught "${(e as Error).message}" in try command`);
        to_return = false;
    }
    return to_return;
}
/**
 * Waits for the trigger file (a file that lets the execution of this extension continue)
 * @param config : current configuration of the extension
 */
export async function wait_for_trigger_file(config:Config) {
    // while loop that waits for the file
    while (true) {
        if (await fs.existsSync(config.triggerFile)) { break; } 
        else { await delay(100); } /// short delay so things don't get crazy
    }
    // removes the trigger file when done
    try { 
        print("removing trigger file");
        await fs.promises.rm(config.triggerFile); 
    } 
    catch ( e ) {
        error(`caught error in waiting for trigger file: ${(e as Error).message}`);
    }
}

/**
 * Gets the current version of the inputted module from pip
 * @param pip : string path to pip executable
 * @param module : string name of module to check
 * @returns current version of the provided module
 */
export async function get_version_of_python_module_with_name(pip:string, module:string):Promise<string> {
    let to_return:string = "";
    try {
        await execProm(`${pip} show ${module}`).then(
            (err) => {
                // if there was output\
                if (err.stdout.length) { 
                    // parsing the output and getting the version
                    let arr:string[] = err.stdout.split("\n");
                    for (let val of arr) {
                        if (val.indexOf("Version")>=0){
                            to_return = val.replace("Version:", "").trim();
                            return;
                        }
                    }
                    
                }
            }
        );
    // catches any errors
    } catch ( e ) {}
    return to_return;
}

/**
 * Determines if a file is in a directory
 * @param dir_path : directory path in string form
 * @param to_find : name of a file that you want to know if it is in dir_path
 * @returns boolean indicating if to_find is in dir_path
 */
export async function check_if_file_in_dir(dir_path : string, to_find : string):Promise<boolean>  {
    try {
        // Loop them all with the new for...of
        for( const entry of await fs.promises.readdir(dir_path) ) {
            // Get the full paths
            if (entry == to_find) {
                if(!((await fs.promises.stat(path.join(dir_path, entry))).isFile())){ return false; } 
                else { return true; }
            }
        }
    }
    // Catch anything bad that happens
    catch( e ) { print(`caught error in check_if_file_in_dir: ${e}`); }
    // default return
    return false;
}


// export async function check_config_dir(config_dir:string, mirror_dir:string):Promise<boolean> {
//     print(`Checking ${config_dir} against ${mirror_dir}`);
//     let exited_good:boolean = true;
//     //making config directory, catches errors, if no errors then continues to building
//     fs.readdir(mirror_dir, (err, files) => {
//         if (err) {
//             print(`Error in reading dir ${mirror_dir}`); 
//             exited_good = false;
//         } 
//         else {
//             // Loop them all with the new for...of
//             for( const entry of files ) {
//                 // Get the full paths
//                 try {
//                     if (!(fs.existsSync(path.join(config_dir, entry)))) {
//                         fs.copyFile(path.join(mirror_dir, entry), path.join(config_dir, entry), (err) => {
//                             if (err){
//                                 print(`> Error copying ${path.join(mirror_dir, entry)} to ${path.join(config_dir, entry)}`);
//                                 exited_good = false;
//                                 return;
//                             } else {
//                                 print(`> Copied ${path.join(mirror_dir, entry)} to ${path.join(config_dir, entry)}`);
//                             }
//                         });
//                     } else {
//                         print(`> Skipped ${entry} because it already exists in ${config_dir}`);
//                     }
//                 } catch ( e ) { 
//                     print(`> ${e}`); 
//                     exited_good = false;
//                     return;
//                 }
//             }
//         }
//     });
//     return exited_good;
// }

/**
 * Makes the provided directory
 * @param dir : string representation of a directory path to make
 * @returns if making the directory succeeded
 */
export async function mkDir(dir:string):Promise<boolean> {
    //print(`Building from ${mirror_dir} to ${config_dir}`)
    let exited_good:boolean = true;
    //making config directory, catches errors, if no errors then continues to building
    fs.mkdir(dir, (err) => {
        if (err) {
            error(`Error making ${dir} with message: ${err.message}`)
            exited_good = false;
        }
    });
    return exited_good;
}


export async function setupSysPython(config:Config):Promise<boolean> {
    print("Setting up for sys python");
    // if python is installed
    if (!(await try_command("python3 --version"))) {
        // no
        print("Python was not detected");
        vscode.window.showErrorMessage("Python was not detected on your system, please install it");
    } else {
        // yes
        // setting python for the config
        config.userConfig.python = "python3";
        // if pip is installed
        if (!(await try_command("pip3 --version"))) {
            // no
            print("python pip was not detected");
            vscode.window.showErrorMessage("python pip was not detected on your system, please install it");
        } else {
            // yes
            // setting pip for the config
            config.userConfig.pip = "pip3";
            // if the module is installed
            if (!(await try_command(`python3 -c \"import ${config.pythonModuleName}\"`))){
                // asking the user if the want to install the python module
                let choice:string|undefined = await vscode.window.showInformationMessage(`the package "${config.pythonModuleName}" is not detected for your python installation, do you want to install it?`, config.yes, config.no);
                // if they want to install the python module
                if (choice === config.yes) {
                    // HAVE NOT YET IMPLEMENT THIS
                    print(`> Would install package ${config.pythonModuleName} from ${config.pythonModulePath}`);
                    return true;
                } else {
                    print(`User skipped installation of package ${config.pythonModuleName}`);
                }
            // if the module is already in python
            } else { return true; }
        }
    }
    return false;
}

/**
 * Gets a dictionary containing information on the user's conda envs
 * @returns Dictionary of infoType type that contains information on the conda envs on the user machine
 */
export async function get_conda_envs():Promise<infoType>{
    let to_return:infoType = {};
    print("Getting conda envs")

    // reading the available conda envs
    let command:string = "conda env list";
    let output:string = "";
    try {
        await execProm(command).then(
            (err) => {
                output = err.stdout; 
                return;
            }
        );
    } catch ( e ) {}
    
    // if something was returned from the env list command
    if (output.length) {
        // parsing the output of the env list command
        let arr:string[] = output.split("\n");
        for (let val of arr.slice(2, arr.indexOf(""))) {
            let new_split = val.replace(/\s+/, " ").split(" ");
            to_return[new_split[0]] = {"path" : new_split[1], "exe" : `${new_split[1]}${path.sep}bin${path.sep}python`, "pip" : `${new_split[1]}${path.sep}bin${path.sep}pip`, "has_qiskit" : false};
            if (await try_command(`${to_return[new_split[0]]["exe"]} -c "import qiskit"`)) {
                to_return[new_split[0]]["has_qiskit"] = true;
            }
        }
    }
    return to_return;
}

/**
 * Checks if python is installed on the user's machine
 * @returns a boolean indicating if python is install on the user's machine
 */
export async function check_if_python_installed():Promise<boolean> {
    return await try_command("python3 --version");
}

/**
 * Checks if pip is installed on the user's machine
 * @returns a boolean indicating if pip is install on the user's machine
 */
export async function check_if_pip_installed():Promise<boolean> {
    return await try_command("pip3 --version");
}

/**
 * Checks if conda is installed on the user's machine
 * @returns a boolean indicating if conda is install on the user's machine
 */
export async function check_if_conda_installed():Promise<boolean> {
    return await try_command("conda --version");
}