import React from "react";
import './Preloader.scss';
import styles from "../../Auth/Auth.module.scss";
import logo from "../../../assets/img/logo.jpg";

const Preloader = ({auth = false}) => {
    return (
        <div className='preloaderWrapper' style={auth ? {backgroundColor: 'var(--bg-main)'} : null}>
            {auth && (
                <div className={'preloaderLogo'}>
                    <img src={logo} alt=""/>
                </div>
            )}
            <div className="preloader">
                <hr/>
                <hr/>
                <hr/>
                <hr/>
            </div>
        </div>

    )
}

export default Preloader;