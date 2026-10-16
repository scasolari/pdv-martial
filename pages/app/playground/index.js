import Layout from "@/components/layout";
import {Button} from "@/components/ui/button";
import {IoPlay} from "react-icons/io5";
import MinimalEditor from "@/components/codeEditor";
import {connect} from "react-redux";
import {useEffect, useState} from "react";
import axios from "axios";
import DynamicTable from "@/components/dynamicTable";
import {TbLoader2} from "react-icons/tb";
import {useTheme} from "next-themes";
import {setDatabase, setQuery, setQueryTable, setQueryTabs} from "@/redux/actions/main";
import SelectDataSet from "@/components/selectDataSet";
import DbTables from "@/components/tables";
import {BiPlus, BiX} from "react-icons/bi";
import {useRouter} from "next/router";
import {Separator} from "@/components/ui/separator";


function Playground(props) {
    const router = useRouter();
    const {database, query, setQuery, setQueryTable, queryTable, setQueryTabs, queryTabs } = props;
    const {theme} = useTheme();
    const [data, setData] = useState(null);
    const [databaseId] = useState(null)
    const [queryErrorMessage, setQueryErrorMessage] = useState("")
    const [queryMessage, setQueryMessage] = useState("")
    const [queryError, setQueryError] = useState(false)
    const [queryOk, setQueryOk] = useState(false)
    const [loading, setLoading] = useState(false)
    const [queryTiming, setQueryTiming] = useState(null)
    const [queryCount, setQueryCount] = useState(null)

    const fetchQuery = () => {
        setLoading(true)
        axios.post("/api/playground/query", {
            db_id: database.db_id || databaseId,
            query: query // Usa solo query dal Redux store
        }).then((res => {
            console.log(res)
            setQueryError(false)
            setQueryOk(true)
            setQueryMessage(res.status + " Ok")
            setData(res.data.data)
            setQueryTable(res.data.data)
            setQueryTiming(res.data.duration_ms)
            setQueryCount(res.data.count)
            console.log(res.data)
            setLoading(false)
        })).catch((error) => {
            console.log(error.response.data.original.sqlMessage)
            setQueryOk(false)
            setQueryError(true)
            setQueryErrorMessage("Error occurred")
            setData({'message': error.response.data.original.sqlMessage})
            setLoading(false)
            setQueryTiming(null)
        })
    }

    const addTab = () => {
        if (queryTabs.length >= 5) {
            return;
        }
        const newId = Math.floor(Math.random() * 900000) + 100000;
        const newTab = {
            id: newId,
            name: "Query",
            queryValue: ""
        };
        setQueryTabs([...queryTabs, newTab]);
    }

    const deleteTab = (id) => {
        const indexToDelete = queryTabs.findIndex(tab => tab.id === id);

        // Filtra il tab con l'ID specificato
        const newTabs = queryTabs.filter(tab => tab.id !== id);

        // Se ci sono ancora tab dopo la cancellazione
        if (newTabs.length > 0) {
            let tabToSelect;

            if (indexToDelete === 0) {
                // Se stai eliminando il primo tab, rimuovi il parametro query
                tabToSelect = null;
            } else {
                // Altrimenti, seleziona il tab precedente
                tabToSelect = newTabs[indexToDelete - 1];
            }

            // Logica per aggiornare il parametro query nella URL
            setQueryTabs(newTabs);
            if (tabToSelect) {
                router.push({
                    pathname: router.pathname,
                    query: { ...router.query, query: tabToSelect.id }
                });
            } else {
                // Se non c'è nessun tab selezionato, rimuovi il parametro query
                router.push({
                    pathname: router.pathname,
                    query: null
                });
            }
        } else {
            // Se non ci sono più tab, rimuovi il parametro query dalla URL
            setQueryTabs(newTabs);
            router.push({
                pathname: router.pathname,
                query: null
            });
        }
    }
    const handleQueryValueChange = (id, newValue) => {
        // Trova il tab che stai modificando
        const updatedTabs = queryTabs.map(tab =>
            tab.id === id ? { ...tab, queryValue: newValue } : tab
        );
        setQueryTabs(updatedTabs);

        // Aggiorna il parametro queryValue nella URL
        router.push({
            pathname: router.pathname,
            query: { ...router.query, queryValue: newValue }
        });
    }


    return <Layout title="Playground">
        <div className="flex flex-row gap-3">
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <SelectDataSet/>
                </div>
                <Separator className="bg-neutral-100 dark:bg-neutral-800"/>
                <div className="overflow-y-scroll min-w-[340px] h-[calc(100vh-130px)]">
                    <DbTables/>
                </div>
            </div>
            <div className="w-full">
                <div>
                    <div className="grid gap-3">
                        <div>
                            {/*<ul className="flex gap-1 px-3 mb-[-1px]">
                                <li onClick={() => {
                                    router.push({
                                        pathname: router.pathname,
                                        query: null
                                    });
                                }}
                                    className={`${router.query.query ? "bg-transparent" : null} flex items-center border border-b-0 border-neutral-100 px-4 py-1 bg-neutral-50 hover:bg-neutral-50 hover:cursor-pointer rounded-t-md w-fit font-semibold`}>Query</li>
                                {queryTabs?.map((d, i) => {
                                    return <li
                                        onClick={() => {
                                            //setQuery(d.queryValue)
                                            router.push({
                                                pathname: router.pathname,
                                                query: {...router.query, query: d.id}
                                            })
                                        }}
                                        key={i}
                                        className={`${router.query.query === String(d.id) ? "!bg-neutral-50 border-b-0" : null} flex items-center gap-3 border border-b-1 border-neutral-100 px-4 py-1 bg-white hover:bg-neutral-50 hover:cursor-pointer rounded-t-md w-fit font-semibold`}>
                                        {d.name}
                                        <BiX size={16} onClick={(e) => {
                                            e.stopPropagation();
                                            deleteTab(d.id)
                                        }} />
                                    </li>
                                })}
                                <li className="flex items-center border border-b-1 border-neutral-100 px-3 py-1 bg-white hover:bg-neutral-50 hover:cursor-pointer rounded-t-md w-fit font-semibold"
                                    onClick={() => addTab()}
                                >
                                    <BiPlus className="font-semibold" size={20}/>
                                </li>
                            </ul>*/}
                            <MinimalEditor
                                onChange={(value) => {
                                    setQuery(value) // Aggiorna solo il Redux store
                                }}
                                theme={theme}
                                initialValue={query}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Button
                                    disabled={!database.db_id || !query || loading === true}
                                    onClick={() => fetchQuery()}
                                    className="!text-sm rounded-lg !font-semibold w-fit bg-blue-600 text-white shadow-none hover:bg-blue-700 flex items-center gap-2 disabled:!cursor-not-allowed">
                                    {loading ? <TbLoader2 className="animate-spin"/> : <IoPlay/>}
                                    Run query
                                </Button>
                                {data &&
                                    <div className="flex items-center gap-2 p-2 px-3.5 rounded-md">
                                        <div>
                                            {queryError && <div className="flex items-center gap-2">
                                                <div className="bg-red-600 h-1.5 w-1.5 rounded-full"/>
                                                <p className="!text-sm text-red-600">{queryErrorMessage}</p>
                                            </div>}
                                            {queryOk && <div className="flex items-center gap-2">
                                                <div className="bg-green-600 h-1.5 w-1.5 rounded-full"/>
                                                <p className="!text-sm font-semibold text-green-600">{queryMessage}</p>
                                            </div>}
                                        </div>
                                        {queryTiming &&
                                            <div>
                                                <p className="!text-sm text-neutral-500 !font-semibold">{queryCount} rows in {queryTiming} ms</p>
                                            </div>
                                        }
                                    </div>
                                }
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="secondary" className="!text-sm !font-semibold rounded-lg shadow-none">
                                    Save query
                                </Button>
                            </div>
                        </div>
                        <div className="rounded-md border border-neutral-100 dark:border-neutral-800 overflow-x-scroll h-[calc(100vh-342px)]">
                            <DynamicTable response={queryTable}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Layout>
}

const mapStateToProps = (state) => {
    return {
        databases: state.databases,
        database: state.database,
        query: state.query,
        queryTable: state.queryTable,
        queryTabs: state.queryTabs,
    };
};

const mapDispatchToProps = {
    setDatabase,
    setQuery,
    setQueryTable,
    setQueryTabs
}

export default connect(mapStateToProps, mapDispatchToProps)(Playground);
