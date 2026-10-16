import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import axios from "axios";
import {useState} from "react";
import {setDatabases} from "@/redux/actions/main";
import {connect} from "react-redux";


function AddDatabase(props) {
    const {databases, setDatabases, onSuccess, onClose} = props
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        db_name: "",
        url_connection: ""
    })
    const [loadingCheckConnection, setLoadingCheckConnection] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [connectionResponse, setConnectionResponse] = useState({
        status: "",
        message: ""
    });
    const add_database = (e) => {
        e.preventDefault();
        setSaveError("");
        axios.post(`/api/database/add`, {
            form: form
        }).then((res) => {
            setDatabases([res.data, ...databases])
            if (onSuccess) {
                onSuccess();
            }
            setOpen(false)
        }).catch((err) => {
            setSaveError(err.response?.data?.error || "Unable to save dataset.");
        })
    }
    const test_db_connection = (e) => {
        if(form.url_connection.length === 0) return null
        setLoadingCheckConnection(true)
        setConnectionResponse({
            status: "",
            message: ""
        })
        axios.post(`/api/database/check-database`, {
            form: form
        }).then((res) => {
            setLoadingCheckConnection(false)
            setConnectionResponse({
                status: true,
                message: res.data.message,
            })
        }).catch((e) => {
            setLoadingCheckConnection(false)
            setConnectionResponse({
                status: false,
                message: e.response?.data?.message || "Unable to connect to the database.",
            })
        })
    }
    return <form onSubmit={add_database} className="flex flex-col gap-3">
        <div>
            <Label className="text-xs font-semibold text-zinc-500">Dataset name</Label>
            <Input
                required
                value={form.db_name}
                onChange={(e) => setForm({
                    ...form,
                    db_name: e.target.value
                })}
                placeholder="Enter dataset name..."
                className="shadow-none border-0 ring-1 ring-zinc-200 px-2 h-8 !text-xs !font-semibold dark:ring-zinc-700 focus-visible:dark:!ring-blue-500"
            />
        </div>
        {saveError && <p role="alert" className="text-xs font-semibold text-red-600">{saveError}</p>}
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-500 font-semibold">Database connection string</Label>
                <div
                    className={`text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-neutral-300 font-semibold hover:cursor-pointer ${loadingCheckConnection && `!text-zinc-500 hover:cursor-not-allowed`}`}
                    onClick={() => test_db_connection()}
                >
                    <div className="flex items-center gap-2">
                        {loadingCheckConnection &&
                            <svg className="size-3 animate-spin text-blue-600"
                                 xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10"
                                        stroke="currentColor"
                                        stroke-width="4"></circle>
                                <path className="opacity-75" fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        }
                        <p>Test connection</p>
                    </div>
                </div>
            </div>
            <Input
                required
                disabled={loadingCheckConnection}
                value={form.url_connection}
                onChange={(e) => setForm({
                    ...form,
                    url_connection: e.target.value
                })}
                placeholder="mysql://root@root:3066"
                className="shadow-none border-0 ring-1 ring-zinc-200 px-2 h-8 !text-xs !font-semibold dark:ring-zinc-700 focus-visible:dark:!ring-blue-500"
            />
            <div>
                {connectionResponse &&
                    <p className={`text-xs font-semibold ${connectionResponse.status ? `text-green-600` : `text-red-600`}`}>{connectionResponse.message}</p>}
            </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
            <Button type="submit"
                    className="flex items-center gap-1 ring-1 ring-blue-500 bg-blue-600 hover:bg-blue-700 border-0 p-1 px-2 h-6 shadow-none text-white dark:text-zinc-100 !text-xs !font-semibold"
            >
                Add dataset
            </Button>
            <Button type="button"
                    onClick={() => {
                        if (onClose) {
                            onClose();
                        }
                    }}
                    className="flex items-center gap-1 ring-1 ring-zinc-300 bg-white hover:bg-zinc-100 text-black dark:ring-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900 border-0 p-1 px-2 h-6 shadow-none dark:text-zinc-100 !text-xs !font-semibold"
            >
                Cancel
            </Button>
        </div>
    </form>
}

const mapStateToProps = (state) => {
    return {
        databases: state.databases,
    };
};

const mapDispatchToProps = {
    setDatabases
};

export default connect(mapStateToProps, mapDispatchToProps)(AddDatabase);
