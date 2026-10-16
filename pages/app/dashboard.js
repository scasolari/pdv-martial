import Layout from "@/components/layout";
import { connect } from "react-redux";
import { useState } from "react";

function Dashboard(props) {
    const { databases } = props;
    const [selectedRows, setSelectedRows] = useState({});

    const handleCheckboxChange = (index) => {
        setSelectedRows(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    return <Layout title="For you">

    </Layout>
}

const mapStateToProps = (state) => {
    return {
        databases: state.databases,
    };
};

export default connect(mapStateToProps, null)(Dashboard);
